/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { UserAreaButton, UserAreaButtonFactory, UserAreaRenderProps } from "@api/UserArea";
import { showNotification } from "@api/Notifications";
import { Logger } from "@utils/Logger";
import definePlugin from "@utils/types";
import { MediaEngineStore, React, VoiceActions } from "@webpack/common";

let faking = false;
let origWS: (data: string | ArrayBufferLike | Blob | ArrayBufferView) => void;

function log(text: string) {
    new Logger("FakeDeafen", "#7b4af7").info(text);
}

function startIntercepting() {
    WebSocket.prototype.send = function (data) {
        const dataType = Object.prototype.toString.call(data);

        switch (dataType) {
            case "[object String]":
                let obj: any;
                try {
                    obj = JSON.parse(data as string);
                } catch {
                    origWS.apply(this, [data]);
                    return;
                }

                // OP 4 é a atualização de estado de voz (Voice State Update)
                if (obj.op === 4 && obj.d !== undefined && obj.d.channel_id !== null) {
                    // Força apenas o self_deaf como true para o servidor,
                    // mantendo o self_mute intacto (permitindo falar normalmente)
                    obj.d.self_deaf = true;
                    origWS.apply(this, [JSON.stringify(obj)]);
                    return;
                }
                break;

            case "[object ArrayBuffer]":
            case "[object Uint8Array]": {
                const buffer = new Uint8Array(data as ArrayBufferLike);
                const decoder = new TextDecoder("utf-8");
                const str = decoder.decode(buffer);
                const idx = str.indexOf("self_deafs\x05false");
                if (idx !== -1) {
                    // Substitui a tag 's\x05false' do ETF pela 's\x04true' (reduzindo 1 byte no buffer)
                    const newBuf = new Uint8Array(buffer.length - 1);
                    newBuf.set(buffer.subarray(0, idx + 9));
                    newBuf.set([0x73, 0x04, 0x74, 0x72, 0x75, 0x65], idx + 9);
                    newBuf.set(buffer.subarray(idx + 16), idx + 15);
                    origWS.apply(this, [newBuf.buffer]);
                    return;
                }
                break;
            }
        }

        origWS.apply(this, [data]);
    };
}

function stopIntercepting() {
    WebSocket.prototype.send = origWS;
}

async function enableFakeDeafen() {
    if (faking) return;
    faking = true;

    // Inicia a interceptação ANTES de qualquer toggle
    // para garantir que o pacote self_deaf: false seja bloqueado
    startIntercepting();

    const wasMuted = MediaEngineStore.isSelfMute();
    const isDeaf = MediaEngineStore.isSelfDeaf();

    if (!isDeaf) {
        // Passo 1: Ativa o deafen (envia self_deaf: true pro servidor, muta localmente)
        await VoiceActions.toggleSelfDeaf();
        await new Promise(f => setTimeout(f, 150));
    }

    // Passo 2: Desativa o deafen localmente (envia self_deaf: false → BLOQUEADO pelo interceptor)
    // Resultado: servidor acha que estamos surdos, mas localmente ouvimos normalmente
    await VoiceActions.toggleSelfDeaf();

    // Restaura o estado do mute se o toggle do deafen alterou
    if (wasMuted !== MediaEngineStore.isSelfMute()) {
        await VoiceActions.toggleSelfMute();
    }

    showNotification({
        title: "FakeDeafen",
        body: "Fake Deafen ativado! Você aparece como surdo mas continua ouvindo normalmente."
    });

    log("Fake deafen ativado");
}

async function disableFakeDeafen() {
    if (!faking) return;
    faking = false;

    // Para a interceptação para que self_deaf: false possa ser enviado
    stopIntercepting();

    const isDeaf = MediaEngineStore.isSelfDeaf();

    if (!isDeaf) {
        // Localmente não estamos surdos (esperado após fake deafen)
        // Precisamos ativar o deafen localmente primeiro para depois desativar
        // e enviar self_deaf: false pro servidor
        await VoiceActions.toggleSelfDeaf();
        await new Promise(f => setTimeout(f, 150));
    }

    // Desativa o deafen (envia self_deaf: false pro servidor)
    await VoiceActions.toggleSelfDeaf();

    showNotification({
        title: "FakeDeafen",
        body: "Fake Deafen desativado. Voltou ao normal."
    });

    log("Fake deafen desativado");
}

const redLinePath = "M22.7 2.7a1 1 0 0 0-1.4-1.4l-20 20a1 1 0 1 0 1.4 1.4Z";
const maskBlackPath = "M23.27 4.73 19.27 .73 -.27 20.27 3.73 24.27Z";
const headphonesPath = "M12 3c-4.97 0-9 4.03-9 9v7c0 1.1.9 2 2 2h4v-8H5v-1c0-3.87 3.13-7 7-7s7 3.13 7 7v1h-4v8h4c1.1 0 2-.9 2-2v-7c0-4.97-4.03-9-9-9z";

function FakeDeafenStaticIcon({ className }: { className?: string; }) {
    return (
        <svg className={className} width="20" height="20" viewBox="0 0 24 24">
            <path fill="currentColor" d={headphonesPath} />
        </svg>
    );
}

function FakeDeafenIcon({ active, className }: { active: boolean; className?: string; }) {
    return (
        <svg className={className} width="20" height="20" viewBox="0 0 24 24">
            <path
                fill={active ? "var(--status-danger)" : "currentColor"}
                mask={active ? "url(#fakedeafenmask)" : void 0}
                d={headphonesPath}
            />
            {active && <>
                <path fill="var(--status-danger)" d={redLinePath} />
                <mask id="fakedeafenmask">
                    <rect fill="white" x="0" y="0" width="24" height="24" />
                    <path fill="black" d={maskBlackPath} />
                </mask>
            </>}
        </svg>
    );
}

function FakeDeafenButton({ iconForeground, hideTooltips, nameplate }: UserAreaRenderProps) {
    const [, forceUpdate] = React.useReducer((x: number) => x + 1, 0);

    const handleToggle = React.useCallback(async () => {
        if (faking) {
            await disableFakeDeafen();
        } else {
            await enableFakeDeafen();
        }
        forceUpdate();
    }, []);

    return (
        <UserAreaButton
            tooltipText={hideTooltips ? void 0 : faking ? "Desativar Fake Deafen" : "Ativar Fake Deafen"}
            icon={<FakeDeafenIcon active={faking} className={iconForeground} />}
            role="switch"
            aria-checked={faking}
            redGlow={faking}
            plated={nameplate != null}
            onClick={handleToggle}
        />
    );
}

const FakeDeafenUserAreaButton: UserAreaButtonFactory = (props: UserAreaRenderProps) => <FakeDeafenButton {...props} />;

export default definePlugin({
    name: "FakeDeafen",
    description: "Finge que você está surdo. (Então você ainda ouve as coisas.)",
    authors: [{ name: "guihzzy", id: 408002057522380801 }, { name: "guihzzy", github: "guihzzy" }],
    dependencies: ["UserAreaAPI"],

    flux: {
        AUDIO_TOGGLE_SELF_DEAF: async function () {
            if (!faking) return;

            await new Promise(f => setTimeout(f, 100));

            // Enquanto o fake deafen está ativo, o estado local deve ser NÃO surdo
            // (ouvimos normalmente enquanto o servidor acha que estamos surdos)
            // Se algo mudou o estado local para surdo, desfazemos (self_deaf: false é bloqueado pelo interceptor)
            if (MediaEngineStore.isSelfDeaf()) {
                await VoiceActions.toggleSelfDeaf();
            }
        }
    },

    userAreaButton: {
        icon: FakeDeafenStaticIcon,
        render: FakeDeafenUserAreaButton
    },

    start() {
        origWS = WebSocket.prototype.send;
        log("Pronto");
    },

    stop() {
        if (faking) {
            stopIntercepting();
            faking = false;
        }
        WebSocket.prototype.send = origWS;
        log("Desarmado");
    }
});
