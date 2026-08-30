/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { definePluginSettings } from "@api/Settings";
import { Notice } from "@components/Notice";
import definePlugin, { OptionType } from "@utils/types";
import { ChannelType } from "@vencord/discord-types/enums";
import {
    CallStore,
    ChannelStore,
    MessageStore,
    React,
    SelectedChannelStore,
    SnowflakeUtils,
    Tooltip,
    useEffect,
    useState,
    useStateFromStores,
    VoiceStateStore
} from "@webpack/common";

const guildVoiceSessionStartTimes = new Map<string, number>();

const settings = definePluginSettings({
    showInDMs: {
        type: OptionType.BOOLEAN,
        description: "Exibir o tempo de chamada ativa em DMs e Grupos.",
        default: true
    },
    showInVoiceChannels: {
        type: OptionType.BOOLEAN,
        description: "Exibir o tempo de chamada ativa em canais de voz de servidores.",
        default: true
    },
    showInStages: {
        type: OptionType.BOOLEAN,
        description: "Exibir o tempo de chamada ativa em canais de palco (Stage).",
        default: true
    },
    badgeFormat: {
        type: OptionType.SELECT,
        description: "Formato do tempo exibido no contador do topo.",
        options: [
            { label: "Padrão com Dias (ex: 5d 11:35:55)", value: "days", default: true },
            { label: "Apenas Dias e Horas (ex: 5d 11h)", value: "human" },
            { label: "Horas Contínuas (ex: 131:35:55)", value: "rawHours" },
        ],
    },
    showHumanTotal: {
        type: OptionType.BOOLEAN,
        description: "Exibir linha 'Tempo total: X dias, Y horas...' no tooltip.",
        default: true
    },
    showInitiator: {
        type: OptionType.BOOLEAN,
        description: "Exibir no tooltip quem iniciou a chamada (em DMs/Grupos).",
        default: true
    },
    showDot: {
        type: OptionType.BOOLEAN,
        description: "Exibir ponto verde pulsante de status ativo.",
        default: true
    }
});

function TimerIcon({ height = 24, width = 24 }: { height?: number; width?: number; }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width={width} height={height} viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
            <polyline points="12 6 12 12 16 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function formatDuration(ms: number, format = "days"): string {
    if (ms < 0) ms = 0;
    const totalSeconds = Math.floor(ms / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const totalHours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const pad = (n: number) => n.toString().padStart(2, "0");

    if (format === "human") {
        if (days > 0) return `${days}d ${hours}h`;
        if (hours > 0) return `${hours}h ${minutes}m`;
        return `${minutes}m ${seconds}s`;
    }

    if (format === "rawHours") {
        if (totalHours > 0) return `${pad(totalHours)}:${pad(minutes)}:${pad(seconds)}`;
        return `${pad(minutes)}:${pad(seconds)}`;
    }

    // Padrão com dias (ex: 5d 11:35:55)
    if (days > 0) {
        return `${days}d ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    }
    if (hours > 0) {
        return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    }
    return `${pad(minutes)}:${pad(seconds)}`;
}

function formatHumanTotalTime(ms: number): string {
    if (ms < 0) ms = 0;
    const totalSeconds = Math.floor(ms / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const parts: string[] = [];
    if (days > 0) parts.push(`${days} ${days === 1 ? "dia" : "dias"}`);
    if (hours > 0) parts.push(`${hours} ${hours === 1 ? "hora" : "horas"}`);
    if (minutes > 0) parts.push(`${minutes} ${minutes === 1 ? "minuto" : "minutos"}`);
    if (seconds > 0 || parts.length === 0) parts.push(`${seconds} ${seconds === 1 ? "segundo" : "segundos"}`);

    if (parts.length === 1) return parts[0];
    const last = parts.pop();
    return `${parts.join(", ")} e ${last}`;
}

function getCallStartInfo(channelId: string, channelType: number): {
    startTime: number | null;
    initiatorName: string | null;
    isDMOrGroup: boolean;
} {
    const isDMOrGroup = channelType === ChannelType.DM || channelType === ChannelType.GROUP_DM;

    if (isDMOrGroup) {
        // 1. Tenta obter o messageId da chamada ativa no CallStore
        const call = CallStore.getCall?.(channelId);
        if (call?.messageId) {
            const timestamp = SnowflakeUtils?.extractTimestamp?.(call.messageId) ??
                Number((BigInt(call.messageId) >> 22n) + 1420070400000n);

            // Procura a mensagem para obter o autor que iniciou
            const msg = MessageStore.getMessage?.(channelId, call.messageId);
            const initiator = msg?.author ? (msg.author.globalName || msg.author.username) : null;

            return {
                startTime: timestamp,
                initiatorName: initiator,
                isDMOrGroup: true
            };
        }

        // 2. Fallback: Procura nas mensagens carregadas a última mensagem de tipo chamada
        try {
            const rawMessages = MessageStore.getMessages?.(channelId) as any;
            if (rawMessages) {
                const arr = rawMessages._array ?? (typeof rawMessages.toArray === "function" ? rawMessages.toArray() : []);
                for (let i = arr.length - 1; i >= 0; i--) {
                    const m = arr[i];
                    // Mensagens de chamada: type 3 ou contendo objeto call
                    if (m.type === 3 || m.type === "CALL" || m.call != null) {
                        const timestamp = m.timestamp
                            ? new Date(m.timestamp).getTime()
                            : Number((BigInt(m.id) >> 22n) + 1420070400000n);

                        const initiator = m.author ? (m.author.globalName || m.author.username) : null;
                        return {
                            startTime: timestamp,
                            initiatorName: initiator,
                            isDMOrGroup: true
                        };
                    }
                }
            }
        } catch {
            // ignora erros de fallback
        }
    }

    // 3. Para canais de servidores / palcos
    const guildStart = guildVoiceSessionStartTimes.get(channelId) ?? null;
    return {
        startTime: guildStart,
        initiatorName: null,
        isDMOrGroup: false
    };
}

function CallTimerBadge() {
    const currentVoiceChannelId = useStateFromStores([SelectedChannelStore], () => SelectedChannelStore.getVoiceChannelId());
    const channel = useStateFromStores([ChannelStore], () => currentVoiceChannelId ? ChannelStore.getChannel(currentVoiceChannelId) : null);
    const [, setTick] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setTick(t => t + 1);
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    if (!channel || !currentVoiceChannelId) return null;

    const isDM = channel.type === ChannelType.DM;
    const isGroupDM = channel.type === ChannelType.GROUP_DM;
    const isStage = channel.type === ChannelType.GUILD_STAGE_VOICE;
    const isGuildVoice = channel.type === ChannelType.GUILD_VOICE;

    if ((isDM || isGroupDM) && !settings.store.showInDMs) return null;
    if (isGuildVoice && !settings.store.showInVoiceChannels) return null;
    if (isStage && !settings.store.showInStages) return null;

    const { startTime, initiatorName, isDMOrGroup } = getCallStartInfo(currentVoiceChannelId, channel.type);
    if (!startTime) return null;

    const now = Date.now();
    const elapsedMs = Math.max(now - startTime, 0);
    const formattedBadgeTime = formatDuration(elapsedMs, settings.store.badgeFormat);
    const formattedDuration = formatDuration(elapsedMs, "days");
    const humanTotalTime = formatHumanTotalTime(elapsedMs);
    const startDate = new Date(startTime);
    const formattedStartTime = startDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    const formattedStartDate = startDate.toLocaleDateString("pt-BR");

    return (
        <Tooltip
            text={
                <div className="call-timer-tooltip-container">
                    <span className="call-timer-tooltip-title">
                        {isDMOrGroup ? "Chamada Direta / Grupo" : "Canal de Voz / Palco"}
                    </span>
                    <span className="call-timer-tooltip-info">
                        Início: <span className="call-timer-tooltip-highlight">{formattedStartTime} ({formattedStartDate})</span>
                    </span>
                    <span className="call-timer-tooltip-info">
                        Duração: <span className="call-timer-tooltip-highlight">{formattedDuration}</span>
                    </span>
                    {settings.store.showHumanTotal && (
                        <span className="call-timer-tooltip-info">
                            Tempo total: <span className="call-timer-tooltip-highlight">{humanTotalTime}</span>
                        </span>
                    )}
                    {settings.store.showInitiator && initiatorName && (
                        <span className="call-timer-tooltip-info">
                            Iniciada por: <span className="call-timer-tooltip-highlight">{initiatorName}</span>
                        </span>
                    )}
                </div>
            }
        >
            {(tooltipProps: any) => (
                <div {...tooltipProps} className="call-timer-badge">
                    {settings.store.showDot && <span className="call-timer-dot" />}
                    <span className="call-timer-text">{formattedBadgeTime}</span>
                </div>
            )}
        </Tooltip>
    );
}

export default definePlugin({
    name: "CallTimer",
    description: "Exibe no topo da chamada o tempo decorrido em tempo real para DMs, Grupos e Canais de Voz.",
    tags: ["Voice", "Utility", "Appearance"],
    authors: [],
    dependencies: ["HeaderBarAPI"],
    settings,

    settingsAboutComponent: () => (
        <Notice.Info>
            <b>CallTimer:</b> Mostra um contador em tempo real no topo da chamada indicando há quanto tempo ela está ativa. Em DMs e Grupos, busca automaticamente o horário exato da mensagem de início da chamada.
        </Notice.Info>
    ),

    headerBarButton: {
        icon: TimerIcon,
        render: () => <CallTimerBadge />,
        priority: 100
    },

    flux: {
        VOICE_CHANNEL_SELECT({ channelId }: { channelId: string | null; }) {
            if (channelId && !guildVoiceSessionStartTimes.has(channelId)) {
                guildVoiceSessionStartTimes.set(channelId, Date.now());
            }
        },

        VOICE_STATE_UPDATES({ voiceStates }: { voiceStates: any[]; }) {
            for (const state of voiceStates) {
                const { channelId, oldChannelId } = state;
                if (channelId && !guildVoiceSessionStartTimes.has(channelId)) {
                    const states = VoiceStateStore.getVoiceStatesForChannel(channelId);
                    if (states && Object.keys(states).length > 0) {
                        guildVoiceSessionStartTimes.set(channelId, Date.now());
                    }
                }
                if (oldChannelId && oldChannelId !== channelId) {
                    const states = VoiceStateStore.getVoiceStatesForChannel(oldChannelId);
                    if (!states || Object.keys(states).length === 0) {
                        guildVoiceSessionStartTimes.delete(oldChannelId);
                    }
                }
            }
        }
    },

    start() {
        const currentId = SelectedChannelStore.getVoiceChannelId();
        if (currentId && !guildVoiceSessionStartTimes.has(currentId)) {
            guildVoiceSessionStartTimes.set(currentId, Date.now());
        }
    },

    stop() {
        guildVoiceSessionStartTimes.clear();
    }
});
