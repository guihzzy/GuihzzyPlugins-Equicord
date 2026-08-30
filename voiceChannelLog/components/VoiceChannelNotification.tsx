/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./VoiceChannelNotification.css";

import { openUserProfile } from "@utils/discord";
import { ChannelStore, createRoot, IconUtils, useEffect, useRef, useState, UserStore } from "@webpack/common";
import type { JSX } from "react";
import type { Root } from "react-dom/client";

import settings from "../settings";
import { VoiceChannelLogEntry } from "../types";

let NotificationQueue: JSX.Element[] = [];
let notificationID = 0;
let RootContainer: Root | undefined;
let ToastContainer: HTMLDivElement | undefined;

function getNotificationContainer() {
    if (!RootContainer) {
        ToastContainer = document.createElement("div");
        ToastContainer.id = "vc-voice-log-notifications-container";
        document.body.append(ToastContainer);
        RootContainer = createRoot(ToastContainer);
    }
    if (ToastContainer) {
        ToastContainer.className = `vc-voice-log-notif-position-${settings.store.notificationPosition ?? "bottom-right"}`;
    }
    return RootContainer;
}

function isPortuguese(): boolean {
    const lang = document.documentElement.lang?.toLowerCase() ?? "";
    return lang.startsWith("pt") || true;
}

const VoiceLogIcon = () => (
    <svg className="vc-voice-log-notif-logo-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v20M17 5v14M22 10v4M7 5v14M2 10v4" />
    </svg>
);

const CloseIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 6L6 18M6 6l12 12" />
    </svg>
);

function getNotificationDetails(entry: Omit<VoiceChannelLogEntry, "timestamp">, pt: boolean) {
    let statusText = "";
    let actionText = "";
    let colorClass: "green" | "red" | "purple" | "orange" | "blue" = "green";

    switch (entry.type) {
        case "join":
            statusText = pt ? "Entrou" : "Joined";
            actionText = pt ? "entrou no canal de voz!" : "joined the voice channel!";
            colorClass = "green";
            break;
        case "leave":
            statusText = pt ? "Saiu" : "Left";
            actionText = pt ? "saiu do canal de voz!" : "left the voice channel!";
            colorClass = "red";
            break;
        case "self_mute":
            statusText = pt ? "Microfone" : "Microphone";
            if (entry.enabled) {
                actionText = pt ? "mutou o próprio microfone!" : "muted their microphone!";
                colorClass = "orange";
            } else {
                actionText = pt ? "desmutou o microfone!" : "unmuted their microphone!";
                colorClass = "green";
            }
            break;
        case "self_deaf":
            statusText = pt ? "Fone de Ouvido" : "Headphones";
            if (entry.enabled) {
                actionText = pt ? "ensurdeceu o áudio (fone desativado)!" : "deafened audio!";
                colorClass = "red";
            } else {
                actionText = pt ? "reativou o áudio do fone!" : "undeafened audio!";
                colorClass = "green";
            }
            break;
        case "self_video":
            statusText = pt ? "Câmera" : "Camera";
            if (entry.enabled) {
                actionText = pt ? "abriu a câmera / vídeo!" : "turned on their camera!";
                colorClass = "green";
            } else {
                actionText = pt ? "fechou a câmera / vídeo!" : "turned off their camera!";
                colorClass = "red";
            }
            break;
        case "self_stream":
            statusText = pt ? "Transmissão" : "Stream";
            if (entry.enabled) {
                actionText = pt ? "começou a compartilhar a tela!" : "started sharing their screen!";
                colorClass = "purple";
            } else {
                actionText = pt ? "parou de compartilhar a tela!" : "stopped sharing their screen!";
                colorClass = "red";
            }
            break;
        case "server_mute":
            statusText = pt ? "Mutado Servidor" : "Server Muted";
            if (entry.enabled) {
                actionText = pt ? "foi mutado no servidor!" : "was server muted!";
                colorClass = "red";
            } else {
                statusText = pt ? "Desmutado Servidor" : "Server Unmuted";
                actionText = pt ? "foi desmutado no servidor!" : "was server unmuted!";
                colorClass = "green";
            }
            break;
        case "server_deafen":
            statusText = pt ? "Ensurdecido Servidor" : "Server Deafened";
            if (entry.enabled) {
                actionText = pt ? "foi ensurdecido no servidor!" : "was server deafened!";
                colorClass = "red";
            } else {
                statusText = pt ? "Áudio Liberado" : "Server Undeafened";
                actionText = pt ? "teve o áudio liberado no servidor!" : "was server undeafened!";
                colorClass = "green";
            }
            break;
        case "soundboard":
            statusText = pt ? "Efeito Sonoro" : "Soundboard";
            const emojiName = entry.emoji?.name ? ` (${entry.emoji.name})` : "";
            actionText = pt ? `tocou um efeito no Soundboard!${emojiName}` : `played a soundboard sound!${emojiName}`;
            colorClass = "orange";
            break;
        case "activity":
            statusText = pt ? "Atividade" : "Activity";
            actionText = pt ? `iniciou a atividade ${entry.activityName ?? ""}!` : `started activity ${entry.activityName ?? ""}!`;
            colorClass = "blue";
            break;
        case "activity_stop":
            statusText = pt ? "Atividade" : "Activity";
            actionText = pt ? `encerrou a atividade ${entry.activityName ?? ""}!` : `stopped activity ${entry.activityName ?? ""}!`;
            colorClass = "red";
            break;
        default:
            statusText = pt ? "Evento" : "Event";
            actionText = pt ? "atualizou o estado de voz." : "updated voice state.";
            colorClass = "green";
    }

    return { statusText, actionText, colorClass };
}

function NotificationCard({ id, entry, onClose }: {
    id: string;
    entry: Omit<VoiceChannelLogEntry, "timestamp">;
    onClose: () => void;
}) {
    const [isClosing, setIsClosing] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const closeTimerRef = useRef<NodeJS.Timeout | null>(null);
    const remainingTimeRef = useRef(5000);
    const startTimeRef = useRef(Date.now());

    const { userId, channelId } = entry;
    const user = UserStore.getUser(userId);
    const channel = ChannelStore.getChannel(channelId);
    const username = user?.globalName ?? user?.username ?? "Usuário";
    const avatarUrl = user
        ? user.getAvatarURL(channel?.getGuildId() ?? undefined, 64)
        : IconUtils.getDefaultAvatarURL(userId);

    const pt = isPortuguese();
    const { statusText, actionText, colorClass } = getNotificationDetails(entry, pt);

    const titleText = pt ? "LOGS DE VOZ" : "VOICE LOGS";
    const timeText = pt ? "agora" : "now";

    const triggerClose = () => {
        if (isClosing) return;
        setIsClosing(true);
        setTimeout(() => {
            onClose();
        }, 300);
    };

    const startCloseTimer = (duration: number) => {
        if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
        startTimeRef.current = Date.now();
        remainingTimeRef.current = duration;
        closeTimerRef.current = setTimeout(() => {
            triggerClose();
        }, duration);
    };

    useEffect(() => {
        startCloseTimer(5000);
        return () => {
            if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
        };
    }, []);

    const handleMouseEnter = () => {
        setIsHovered(true);
        if (closeTimerRef.current) {
            clearTimeout(closeTimerRef.current);
            const elapsed = Date.now() - startTimeRef.current;
            remainingTimeRef.current = Math.max(remainingTimeRef.current - elapsed, 0);
        }
    };

    const handleMouseLeave = () => {
        setIsHovered(false);
        if (!isClosing) {
            startCloseTimer(remainingTimeRef.current);
        }
    };

    return (
        <div
            className={`vc-voice-log-notif-card ${isClosing ? "is-closing" : ""}`}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            <div className="vc-voice-log-notif-header">
                <div className="vc-voice-log-notif-header-left">
                    <VoiceLogIcon />
                    <span className="vc-voice-log-notif-title">{titleText}</span>
                    <span className="vc-voice-log-notif-dot-separator">•</span>
                    <div className="vc-voice-log-notif-status-wrapper">
                        <span className={`vc-voice-log-notif-status-dot ${colorClass}`} />
                        <span className="vc-voice-log-notif-status-text">{statusText}</span>
                    </div>
                </div>
                <div className="vc-voice-log-notif-header-right">
                    <span className="vc-voice-log-notif-time">{timeText}</span>
                    <button
                        type="button"
                        className="vc-voice-log-notif-close"
                        onClick={triggerClose}
                        title={pt ? "Fechar" : "Close"}
                    >
                        <CloseIcon />
                    </button>
                </div>
            </div>

            <div className="vc-voice-log-notif-body">
                <img
                    className="vc-voice-log-notif-avatar"
                    src={avatarUrl}
                    alt={username}
                    onClick={() => openUserProfile(userId)}
                />
                <div className="vc-voice-log-notif-content">
                    <span
                        className="vc-voice-log-notif-user"
                        onClick={() => openUserProfile(userId)}
                    >
                        {username}
                    </span>
                    <span className="vc-voice-log-notif-message">{actionText}</span>
                </div>
            </div>

            <div className="vc-voice-log-notif-progress-bg">
                <div
                    className={`vc-voice-log-notif-progress-bar ${colorClass}`}
                    style={{ animationPlayState: isHovered ? "paused" : "running" }}
                />
            </div>
        </div>
    );
}

export function showVoiceNotification(entry: Omit<VoiceChannelLogEntry, "timestamp">) {
    if (!settings.store.showNotifications) return;
    const root = getNotificationContainer();
    const thisID = notificationID++;

    return new Promise<void>(resolve => {
        const ToastNotification = (
            <NotificationCard
                key={thisID.toString()}
                id={thisID.toString()}
                entry={entry}
                onClose={() => {
                    NotificationQueue = NotificationQueue.filter(n => n.key !== thisID.toString());
                    if (RootContainer) {
                        RootContainer.render(<>{NotificationQueue}</>);
                    }
                    resolve();
                }}
            />
        );

        NotificationQueue.push(ToastNotification);

        if (NotificationQueue.length > 5) {
            NotificationQueue.shift();
        }

        root.render(<>{NotificationQueue}</>);
    });
}

export function teardownVoiceNotifications() {
    NotificationQueue = [];
    RootContainer?.unmount();
    RootContainer = undefined;
    ToastContainer?.remove();
    ToastContainer = undefined;
}
