/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";
import type { Channel, Message } from "@vencord/discord-types";
import { findByPropsLazy } from "@webpack";
import {
    AuthenticationStore,
    ChannelStore,
    EditMessageStore,
    MessageActions,
    MessageStore,
    PermissionsBits,
    PermissionStore,
    React,
    SelectedChannelStore
} from "@webpack/common";

const ChannelSettingsActions = findByPropsLazy("open", "setSection");

type Modifier = "NONE" | "SHIFT" | "CTRL" | "ALT";

const modifiers: { label: string; value: Modifier; }[] = [
    { label: "Nenhum (Apenas Duplo Clique)", value: "NONE" },
    { label: "Shift", value: "SHIFT" },
    { label: "Ctrl", value: "CTRL" },
    { label: "Alt", value: "ALT" },
];

function isModifierMatch(e: MouseEvent, modifier: Modifier): boolean {
    switch (modifier) {
        case "NONE":
            return !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey;
        case "SHIFT":
            return e.shiftKey;
        case "CTRL":
            return e.ctrlKey || e.metaKey;
        case "ALT":
            return e.altKey;
        default:
            return true;
    }
}

const settings = definePluginSettings({
    editMessages: {
        type: OptionType.BOOLEAN,
        description: "Editar mensagens próprias ao dar duplo clique com o botão esquerdo.",
        default: true
    },
    editChannels: {
        type: OptionType.BOOLEAN,
        description: "Editar canais de texto, voz, fóruns e categorias ao dar duplo clique com o botão esquerdo.",
        default: true
    },
    checkPermissions: {
        type: OptionType.BOOLEAN,
        description: "Verificar se você tem permissão de gerenciar canais/tópicos antes de tentar abrir a edição.",
        default: true
    },
    modifier: {
        type: OptionType.SELECT,
        description: "Tecla modificadora opcional para ativar o duplo clique.",
        options: modifiers,
        default: "NONE"
    }
});

function QuickEditHeader() {
    return (
        <div className="quickedit-header-card">
            <div className="quickedit-left">
                <div className="quickedit-icon-box">
                    <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                </div>
                <div className="quickedit-text-container">
                    <div className="quickedit-title-row">
                        <span className="quickedit-title">Configurações Gerais</span>
                        <span className="quickedit-status-badge">
                            <span className="quickedit-status-dot" />
                            SISTEMA ATIVO
                        </span>
                    </div>
                    <span className="quickedit-description">
                        Defina ações de edição instantânea para mensagens e canais através de duplo clique esquerdo.
                    </span>
                </div>
            </div>
            <div className="quickedit-right-badges">
                <div className="quickedit-pill-badge">
                    <span className="quickedit-pill-label">MODO:</span>
                    <span className="quickedit-pill-value">2X CLIQUE</span>
                </div>
                <div className="quickedit-pill-badge">
                    <span className="quickedit-pill-label">PERMS:</span>
                    <span className="quickedit-pill-value">{settings.store.checkPermissions ? "VALIDADAS" : "LIVRE"}</span>
                </div>
            </div>
        </div>
    );
}

function getChannelIdFromElement(el: HTMLElement | null): string | null {
    if (!el) return null;

    // Procura por links de canais: /channels/<guildId>/<channelId> ou /channels/@me/<channelId>
    const anchor = el.closest<HTMLAnchorElement>('a[href*="/channels/"]');
    if (anchor) {
        const match = anchor.href.match(/\/channels\/(?:\d+|@me)\/(\d+)/);
        if (match?.[1]) return match[1];
    }

    // Procura por itens de lista de canais: data-list-item-id="channels___<channelId>"
    const listItem = el.closest<HTMLElement>('[data-list-item-id^="channels___"]');
    if (listItem) {
        const rawId = listItem.getAttribute("data-list-item-id")?.replace("channels___", "");
        if (rawId && /^\d+$/.test(rawId)) return rawId;
    }

    return null;
}

function getMessageInfoFromElement(el: HTMLElement | null): { messageId: string; channelId?: string; } | null {
    if (!el) return null;

    // 1. Procura por elementos da mensagem no chat (ex: chat-messages-channelId-messageId ou chat-messages___messageId)
    const messageLi = el.closest<HTMLElement>('[id*="chat-messages-"], [id*="chat-messages___"], [data-list-item-id*="chat-messages___"]');
    if (messageLi) {
        const idAttr = messageLi.id || messageLi.getAttribute("data-list-item-id") || "";
        const numbers = idAttr.match(/\d{17,20}/g);
        if (numbers && numbers.length >= 2) {
            return { channelId: numbers[0], messageId: numbers[1] };
        } else if (numbers && numbers.length === 1) {
            return { messageId: numbers[0] };
        }
    }

    // 2. Procura pelo container do conteúdo da mensagem: id="message-content-<messageId>"
    const contentEl = el.closest<HTMLElement>('[id^="message-content-"]');
    if (contentEl) {
        const messageId = contentEl.id.replace("message-content-", "");
        if (/^\d{17,20}$/.test(messageId)) {
            return { messageId };
        }
    }

    // 3. Procura por acessórios da mensagem: id="message-accessories-<messageId>"
    const accEl = el.closest<HTMLElement>('[id^="message-accessories-"]');
    if (accEl) {
        const messageId = accEl.id.replace("message-accessories-", "");
        if (/^\d{17,20}$/.test(messageId)) {
            return { messageId };
        }
    }

    return null;
}

function handleGlobalDoubleClick(e: MouseEvent) {
    if (e.button !== 0) return;
    if (!isModifierMatch(e, settings.store.modifier as Modifier)) return;

    const target = e.target as HTMLElement | null;
    if (!target) return;

    // 1. Tratamento de duplo clique em CANAL
    if (settings.store.editChannels) {
        const channelId = getChannelIdFromElement(target);
        if (channelId) {
            const channel = ChannelStore.getChannel(channelId);
            if (channel) {
                if (settings.store.checkPermissions && channel.guild_id) {
                    const requiredPerm = channel.isThread?.()
                        ? PermissionsBits.MANAGE_THREADS
                        : PermissionsBits.MANAGE_CHANNELS;

                    const canManage = PermissionStore.can(requiredPerm, channel);
                    if (!canManage) return;
                }

                e.preventDefault();
                e.stopPropagation();

                try {
                    ChannelSettingsActions?.open?.(channel.id);
                } catch (err) {
                    console.error("[QuickEdit] Falha ao abrir configurações do canal:", err);
                }
                return;
            }
        }
    }

    // 2. Tratamento de duplo clique em MENSAGEM
    if (settings.store.editMessages) {
        // Ignora cliques dentro de inputs, textareas ou botões interativos
        if (target.closest("input, textarea, button, a[href]:not([href='#']), [role='button']")) return;

        const info = getMessageInfoFromElement(target);
        if (info) {
            const channelId = info.channelId || SelectedChannelStore.getChannelId();
            if (!channelId) return;

            const message = MessageStore.getMessage(channelId, info.messageId);
            if (!message) return;

            const myId = AuthenticationStore.getId();
            if (message.author?.id !== myId) return;
            if (message.state === "SENDING" || message.state === "SEND_FAILED") return;
            if (EditMessageStore.isEditing(channelId, message.id)) return;

            // Remove a seleção de texto gerada pelo duplo clique nativo do navegador
            const selection = window.getSelection();
            selection?.removeAllRanges();

            e.preventDefault();
            e.stopPropagation();

            MessageActions.startEditMessage(channelId, message.id, message.content || "");
        }
    }
}

export default definePlugin({
    name: "QuickEdit",
    description: "Edita suas mensagens ou canais de texto/voz rapidamente clicando duas vezes com o botão esquerdo.",
    tags: ["Chat", "Shortcuts", "Utility", "Servers"],
    authors: [],
    settings,

    settingsAboutComponent: () => <QuickEditHeader />,

    start() {
        document.addEventListener("dblclick", handleGlobalDoubleClick, true);
    },

    stop() {
        document.removeEventListener("dblclick", handleGlobalDoubleClick, true);
    },

    onMessageClick(msg: Message, channel: Channel, event: MouseEvent) {
        if (!settings.store.editMessages) return;
        if (event.detail !== 2 || event.button !== 0) return;
        if (!isModifierMatch(event, settings.store.modifier as Modifier)) return;

        const myId = AuthenticationStore.getId();
        if (msg.author?.id !== myId) return;
        if (msg.state === "SENDING" || msg.state === "SEND_FAILED") return;
        if (EditMessageStore.isEditing(channel.id, msg.id)) return;

        event.preventDefault();
        MessageActions.startEditMessage(channel.id, msg.id, msg.content || "");
    }
});
