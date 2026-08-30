/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import { definePluginSettings } from "@api/Settings";
import { Notice } from "@components/Notice";
import definePlugin, { OptionType } from "@utils/types";
import { Channel, User, VoiceState } from "@vencord/discord-types";
import { ChannelType } from "@vencord/discord-types/enums";
import { ChannelActions, ChannelStore, Menu, React, SelectedChannelStore, showToast, Toasts, UserStore, VoiceStateStore } from "@webpack/common";

const lastUserChannels = new Map<string, string>();
let lastMyChannelId: string | null = null;
let lastMyChannelTime = 0;

const settings = definePluginSettings({
    notifyOnTransfer: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Exibir notificação quando a chamada for transferida para o PC."
    },
    onlyDms: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Apenas transferir chamadas de DMs e Grupos (ignorar canais de servidores)."
    }
}).withPrivateSettings<{
    monitoredUsers?: string[];
}>();

function isDmOrGroupDm(channel: Channel | undefined): boolean {
    if (!channel) return true;
    if (channel.guild_id) return false;
    return (
        (typeof channel.isDM === "function" && channel.isDM()) ||
        (typeof channel.isGroupDM === "function" && channel.isGroupDM()) ||
        (typeof channel.isMultiUserDM === "function" && channel.isMultiUserDM()) ||
        channel.type === ChannelType.DM ||
        channel.type === ChannelType.GROUP_DM
    );
}

const UserContextMenuPatch: NavContextMenuPatchCallback = (children, { user }: { user?: User; }) => {
    const myId = UserStore.getCurrentUser()?.id;
    if (!user?.id || user.id === myId) return;

    const monitoredUsers = settings.store.monitoredUsers ?? [];
    const [checked, setChecked] = React.useState(monitoredUsers.includes(user.id));

    children.push(
        <Menu.MenuSeparator />,
        <Menu.MenuCheckboxItem
            id="vc-call-keeper-user"
            label="CallKeeper"
            checked={checked}
            action={() => {
                const current = settings.store.monitoredUsers ?? [];
                if (current.includes(user.id)) {
                    settings.store.monitoredUsers = current.filter(id => id !== user.id);
                    setChecked(false);
                } else {
                    settings.store.monitoredUsers = [...current, user.id];
                    setChecked(true);
                    const vs = VoiceStateStore.getVoiceStateForUser(user.id);
                    if (vs?.channelId) {
                        lastUserChannels.set(user.id, vs.channelId);
                    }
                }
            }}
        />
    );
};

export default definePlugin({
    name: "CallKeeper",
    description: "Transfere automaticamente a chamada do celular para o PC quando o usuário monitorado sair de uma DM ou Group DM.",
    tags: ["Voice", "Utility"],
    authors: [],
    settings,
    settingsAboutComponent: () => (
        <Notice.Info>
            Clique com o botão direito em um usuário para ativar ou desativar o <b>CallKeeper</b>.
            Enquanto você estiver em uma DM ou Group DM pelo celular com essa pessoa, quando ela sair da chamada,
            sua conexão será automaticamente transferida para o PC.
        </Notice.Info>
    ),
    contextMenus: {
        "user-context": UserContextMenuPatch
    },
    flux: {
        VOICE_STATE_UPDATES({ voiceStates }: { voiceStates: VoiceState[]; }) {
            const myId = UserStore.getCurrentUser()?.id;
            if (!myId) return;

            const monitoredUsers = settings.store.monitoredUsers ?? [];
            const previousMyChannelId = lastMyChannelId;
            const previousMyChannelTime = lastMyChannelTime;

            // Primeiro: Atualiza o estado da própria conta
            for (const voiceState of voiceStates) {
                if (voiceState.userId === myId) {
                    if (voiceState.channelId) {
                        lastMyChannelId = voiceState.channelId;
                        lastMyChannelTime = Date.now();
                        lastUserChannels.set(myId, voiceState.channelId);
                    } else {
                        lastUserChannels.delete(myId);
                        lastMyChannelTime = Date.now();
                    }
                }
            }

            // Segundo: Verifica eventos de saída dos usuários monitorados
            for (const voiceState of voiceStates) {
                const { userId, channelId } = voiceState;

                // Ignora se for a própria conta
                if (userId === myId) continue;

                const oldChannelId = voiceState.oldChannelId ?? lastUserChannels.get(userId) ?? VoiceStateStore.getVoiceStateForUser(userId)?.channelId;

                // Atualiza o mapa de canais
                if (channelId) {
                    lastUserChannels.set(userId, channelId);
                } else {
                    lastUserChannels.delete(userId);
                }

                // Apenas monitora se o CallKeeper estiver ativado para essa pessoa
                if (!monitoredUsers.includes(userId)) continue;

                // Detecta se a outra pessoa saiu da chamada
                const leftChannelId = (oldChannelId && !channelId)
                    ? oldChannelId
                    : (oldChannelId && channelId && oldChannelId !== channelId ? oldChannelId : null);

                if (!leftChannelId) continue;

                // Validação: Verificar se é DM/Grupo se configurado
                if (settings.store.onlyDms) {
                    const channel = ChannelStore.getChannel(leftChannelId);
                    if (!isDmOrGroupDm(channel)) continue;
                }

                // Validação: Eu estava na mesma chamada (no mobile ou outro client)
                const currentMyVoiceState = VoiceStateStore.getVoiceStateForUser(myId);
                const wasInSameCall =
                    currentMyVoiceState?.channelId === leftChannelId ||
                    previousMyChannelId === leftChannelId ||
                    lastMyChannelId === leftChannelId ||
                    (Date.now() - previousMyChannelTime < 20000 && previousMyChannelId === leftChannelId);

                if (!wasInSameCall) continue;

                // Validação: Se você já estiver conectado em chamada pelo PC, não faz nada
                const pcVoiceChannelId = SelectedChannelStore.getVoiceChannelId();
                if (pcVoiceChannelId) continue;

                // Todas as condições atendidas: transferir conexão para o PC fora do ciclo de dispatch
                setTimeout(() => {
                    const currentPcVoice = SelectedChannelStore.getVoiceChannelId();
                    if (currentPcVoice) return;

                    ChannelActions.selectVoiceChannel(leftChannelId);

                    if (settings.store.notifyOnTransfer) {
                        showToast("CallKeeper: Chamada transferida para o PC.", Toasts.Type.SUCCESS);
                    }
                }, 100);
            }
        }
    },
    start() {
        lastUserChannels.clear();
        lastMyChannelId = null;
        lastMyChannelTime = 0;

        const myId = UserStore.getCurrentUser()?.id;
        if (myId) {
            const myState = VoiceStateStore.getVoiceStateForUser(myId);
            if (myState?.channelId) {
                lastMyChannelId = myState.channelId;
                lastMyChannelTime = Date.now();
                lastUserChannels.set(myId, myState.channelId);
            }
        }

        try {
            const allStates = VoiceStateStore.getAllVoiceStates?.();
            if (allStates) {
                for (const guildId in allStates) {
                    const guildStates = allStates[guildId];
                    for (const uId in guildStates) {
                        const vs = guildStates[uId];
                        if (vs?.channelId) {
                            lastUserChannels.set(uId, vs.channelId);
                        }
                    }
                }
            }
        } catch {
            // Ignora se não suportado
        }

        const monitoredUsers = settings.store.monitoredUsers ?? [];
        for (const userId of monitoredUsers) {
            const vs = VoiceStateStore.getVoiceStateForUser(userId);
            if (vs?.channelId) {
                lastUserChannels.set(userId, vs.channelId);
            }
        }
    },
    stop() {
        lastUserChannels.clear();
        lastMyChannelId = null;
        lastMyChannelTime = 0;
    }
});
