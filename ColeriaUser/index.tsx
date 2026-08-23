/*
 * Vencord, um mod para o Discord
 * Copyright (c) 2024 Vendicated
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import { definePluginSettings, useSettings } from "@api/Settings";
import ErrorBoundary from "@components/ErrorBoundary";
import { Devs } from "@utils/constants";
import { classes } from "@utils/misc";
import definePlugin, { OptionType } from "@utils/types";
import { findComponentByCodeLazy, findStoreLazy } from "@webpack";
import {
    ChannelStore,
    Constants,
    Menu,
    PermissionsBits,
    PermissionStore,
    React,
    RestAPI,
    SelectedChannelStore,
    Toasts,
    UserStore
} from "@webpack/common";
import type { Channel, User } from "discord-types/general";
import type { PropsWithChildren, SVGProps } from "react";

const HeaderBarIcon = findComponentByCodeLazy(".HEADER_BAR_BADGE_TOP:", '.iconBadge,"top"');

interface IconProps extends SVGProps<SVGSVGElement> {
    className?: string;
    height?: string | number;
    width?: string | number;
}

interface BaseIconProps extends IconProps {
    viewBox: string;
}

function Icon({
    height = 24,
    width = 24,
    className,
    children,
    viewBox,
    ...svgProps
}: PropsWithChildren<BaseIconProps>) {
    return (
        <svg
            className={classes(className, "vc-icon")}
            role="img"
            width={width}
            height={height}
            viewBox={viewBox}
            {...svgProps}
        >
            {children}
        </svg>
    );
}

function LeashIcon(props: IconProps) {
    return (
        <Icon
            {...props}
            className={classes(props.className, "vc-leash-icon")}
            viewBox="0 -960 960 960"
        >
            <path
                fill="currentColor"
                d="M200-480q-50 0-85-35t-35-85 35-85 85-35 85 35 35 85-35 85-85 35Zm240 240-25-160q-6-36 7-71.5t43-61.5q20-20 33-43t17-49q2-10-4-17t-16-7h-169q-18 38-52 60.5T200-640q-66 0-113-47T40-800q0-66 47-113t113-47q44 0 79 23.5t53 60.5h198q62 0 103 45t27 105q-10 53-38.5 95.5T547-551q-14 14-20 33t-3 38l25 160h-109Zm320 80q-50 0-85-35t-35-85v-120q0-50 35-85t85-35 85 35 35 85v120q0 50-35 85t-85 35Zm0-80q17 0 28.5-11.5T800-320v-120q0-17-11.5-28.5T760-480q-17 0-28.5 11.5T720-440v120q0 17 11.5 28.5T760-240Z"
            />
        </Icon>
    );
}

interface VoiceState {
    userId: string;
    channelId?: string;
    oldChannelId?: string;
}

interface VoiceStateStore {
    getVoiceStateForUser(userId: string): VoiceState | undefined;
}

const VoiceStateStore: VoiceStateStore = findStoreLazy("VoiceStateStore");

const summonCooldown = new Map<string, number>();
const COOLDOWN_MS = 1200;

function buildGuildMemberEndpoint(guildId: string, userId: string) {
    const endpoints = Constants.Endpoints as Record<string, ((...args: any[]) => string) | undefined>;
    const builder = endpoints?.GUILD_MEMBER;
    return typeof builder === "function" ? builder(guildId, userId) : `/guilds/${guildId}/members/${userId}`;
}

function getLeashedUserIds(): string[] {
    const ids = settings.store.leashedUserIds || "";
    return ids ? ids.split(",").filter(id => id.trim()) : [];
}

function setLeashedUserIds(ids: string[]) {
    settings.store.leashedUserIds = ids.filter(id => id.trim()).join(",");
}

function addLeashedUser(userId: string) {
    const ids = getLeashedUserIds();
    if (!ids.includes(userId)) {
        ids.push(userId);
        setLeashedUserIds(ids);
    }
}

function removeLeashedUser(userId: string) {
    const ids = getLeashedUserIds();
    setLeashedUserIds(ids.filter(id => id !== userId));
}

function isUserLeashed(userId: string): boolean {
    return getLeashedUserIds().includes(userId);
}

export const settings = definePluginSettings({
    autoSummon: {
        type: OptionType.BOOLEAN,
        description: "Mover automaticamente os usuários presos sempre que você entrar em um canal de voz",
        default: true,
        restartNeeded: false
    },
    enforceWhileConnected: {
        type: OptionType.BOOLEAN,
        description: "Se os usuários escaparem enquanto você está em call, puxar de volta para o seu canal",
        default: true,
        restartNeeded: false
    },
    releaseOnLeave: {
        type: OptionType.BOOLEAN,
        description: "Desconectar os usuários quando você sair de todas as chamadas",
        default: false,
        restartNeeded: false
    },
    leashedUserIds: {
        type: OptionType.STRING,
        description: "IDs dos usuários presos pela Coleira (separados por vírgula)",
        hidden: true,
        default: "",
        restartNeeded: false
    }
});

interface SummonOptions {
    silent?: boolean;
    reason?: string;
}

function showToast(message: string, type: Toasts.Type = Toasts.Type.INFO) {
    Toasts.show({
        message,
        type,
        id: Toasts.genId()
    });
}

function isOnCooldown(channelId: string, reason?: string) {
    const key = `${channelId}:${reason ?? "none"}`;
    const now = Date.now();
    const last = summonCooldown.get(key) ?? 0;
    if (now - last < COOLDOWN_MS) {
        return true;
    }
    summonCooldown.set(key, now);
    return false;
}

async function summonSingleUser(userId: string, channelId: string, channel: any, opts: SummonOptions = {}) {
    const voiceState = VoiceStateStore.getVoiceStateForUser(userId);
    if (!voiceState?.channelId) {
        return { success: false, reason: "offline" };
    }

    const targetChannel = ChannelStore.getChannel(voiceState.channelId);
    if (targetChannel?.guild_id && targetChannel.guild_id !== channel.guild_id) {
        return { success: false, reason: "different-server" };
    }

    if (voiceState.channelId === channel.id) {
        return { success: false, reason: "already-here" };
    }

    try {
        await RestAPI.patch({
            url: buildGuildMemberEndpoint(channel.guild_id, userId),
            body: { channel_id: channel.id }
        });
        return { success: true };
    } catch (error) {
        console.error("[ColeriaUser] Falha ao mover usuário", userId, error);
        return { success: false, reason: "error" };
    }
}

async function summonLeashedUsers(explicitChannelId?: string | null, opts: SummonOptions = {}) {
    const userIds = getLeashedUserIds();
    if (userIds.length === 0) {
        if (!opts.silent) {
            showToast("Nenhum usuário está com a Coleira ativa", Toasts.Type.FAILURE);
        }
        return;
    }

    const channelId = explicitChannelId ?? SelectedChannelStore.getVoiceChannelId();
    if (!channelId) {
        if (!opts.silent) {
            showToast("Você não está conectado a um canal de voz", Toasts.Type.FAILURE);
        }
        return;
    }

    if (isOnCooldown(channelId, opts.reason)) {
        return;
    }

    const channel = ChannelStore.getChannel(channelId);
    if (!channel?.guild_id) {
        if (!opts.silent) {
            showToast("Não dá para mover usuários para este canal", Toasts.Type.FAILURE);
        }
        return;
    }

    if (!PermissionStore.can(PermissionsBits.MOVE_MEMBERS, channel)) {
        if (!opts.silent) {
            showToast("Você precisa da permissão de mover membros neste canal", Toasts.Type.FAILURE);
        }
        return;
    }

    let movedCount = 0;
    const results = await Promise.all(
        userIds.map(userId => summonSingleUser(userId, channelId, channel, opts))
    );

    results.forEach((result, index) => {
        if (result.success) {
            movedCount++;
        }
    });

    if (!opts.silent && movedCount > 0) {
        const channelName = channel.name;
        if (movedCount === 1) {
            const userId = userIds.find((id, idx) => results[idx].success);
            const username = userId ? UserStore.getUser(userId)?.username : "Usuário";
            showToast(`Coleira puxou ${username} para ${channelName}`, Toasts.Type.SUCCESS);
        } else {
            showToast(`Coleira puxou ${movedCount} usuário${movedCount > 1 ? "s" : ""} para ${channelName}`, Toasts.Type.SUCCESS);
        }
    }
}

async function releaseLeashedUsers(referenceChannelId?: string | null, opts: SummonOptions = {}) {
    const userIds = getLeashedUserIds();
    if (userIds.length === 0) {
        return;
    }

    let disconnectedCount = 0;

    for (const userId of userIds) {
        const voiceState = VoiceStateStore.getVoiceStateForUser(userId);
        const channelId = referenceChannelId ?? voiceState?.channelId;
        if (!channelId) continue;

        const channel = ChannelStore.getChannel(channelId);
        if (!channel?.guild_id) continue;

        if (!PermissionStore.can(PermissionsBits.MOVE_MEMBERS, channel)) continue;

        try {
            await RestAPI.patch({
                url: buildGuildMemberEndpoint(channel.guild_id, userId),
                body: { channel_id: null }
            });
            disconnectedCount++;
        } catch (error) {
            console.error("[ColeriaUser] Falha ao desconectar usuário", userId, error);
        }
    }

    if (!opts.silent && disconnectedCount > 0) {
        showToast(`Coleira solta: ${disconnectedCount} usuário${disconnectedCount > 1 ? "s" : ""} desconectado${disconnectedCount > 1 ? "s" : ""}`, Toasts.Type.SUCCESS);
    }
}

function toggleLeash(userId: string) {
    if (isUserLeashed(userId)) {
        removeLeashedUser(userId);
        const username = UserStore.getUser(userId)?.username ?? "Usuário";
        showToast(`${username} liberado da Coleira`, Toasts.Type.SUCCESS);
    } else {
        addLeashedUser(userId);
        const username = UserStore.getUser(userId)?.username ?? "Usuário";
        const count = getLeashedUserIds().length;
        showToast(`Coleira aplicada em ${username}! (${count} usuário${count > 1 ? "s" : ""} total)`, Toasts.Type.SUCCESS);
        if (settings.store.autoSummon) {
            void summonLeashedUsers(undefined, { reason: "toggle" });
        }
    }
}

interface UserContextProps {
    channel: Channel;
    guildId?: string;
    user: User;
}

const UserContext: NavContextMenuPatchCallback = (children, { user }: UserContextProps) => {
    if (!user || user.id === UserStore.getCurrentUser().id) return;
    const isLeashed = isUserLeashed(user.id);

    children.splice(-1, 0, (
        <Menu.MenuGroup>
            <Menu.MenuItem
                id="coleria-user"
                label={isLeashed ? "Remover Coleira" : "Colocar Coleira"}
                icon={LeashIcon}
                action={() => toggleLeash(user.id)}
            />
        </Menu.MenuGroup>
    ));
};

export default definePlugin({
    name: "ColeriaUser",
    description: "Puxa qualquer usuário que você marcar para o mesmo canal de voz que você estiver",
    authors: [Devs.Guih],
    settings,

    start() {
        // Resetar os usuários presos na inicialização do client para evitar puxar automaticamente ao abrir um novo client/sessão
        setLeashedUserIds([]);
    },

    stop() {
        setLeashedUserIds([]);
    },

    patches: [
        {
            find: "toolbar:function",
            replacement: {
                match: /(function \i\(\i\){)(.{1,200}toolbar.{1,100}mobileToolbar)/,
                replace: "$1$self.addIconToToolBar(arguments[0]);$2"
            }
        }
    ],

    contextMenus: {
        "user-context": UserContext
    },

    flux: {
        VOICE_STATE_UPDATES({ voiceStates }: { voiceStates: VoiceState[]; }) {
            const leashedIds = getLeashedUserIds();
            if (leashedIds.length === 0) {
                return;
            }

            const myId = UserStore.getCurrentUser().id;

            for (const { userId, channelId, oldChannelId } of voiceStates) {
                if (userId === myId) {
                    // Se entrei em um canal (mesmo que oldChannelId seja igual por evento duplicado)
                    if (channelId && settings.store.autoSummon) {
                        void summonLeashedUsers(channelId, { reason: "self-move" });
                    } 
                    // Se saí de um canal (channelId é null)
                    else if (!channelId && oldChannelId && settings.store.releaseOnLeave) {
                        void releaseLeashedUsers(oldChannelId, { reason: "self-leave" });
                    }
                    continue;
                }

                // Ignorar eventos duplicados para outros usuários
                if (channelId === oldChannelId) {
                    continue;
                }

                if (leashedIds.includes(userId) && settings.store.enforceWhileConnected) {
                    const myChannel = SelectedChannelStore.getVoiceChannelId();
                    if (!myChannel) continue;
                    if (!channelId || channelId !== myChannel) {
                        void summonLeashedUsers(myChannel, { reason: "target-drift", silent: true });
                    }
                }
            }
        }
    },

    ColeiraIndicator() {
        const { plugins: { ColeriaUser: { leashedUserIds } } } = useSettings(["plugins.ColeriaUser.leashedUserIds"]);
        const userIds = getLeashedUserIds();
        
        if (userIds.length === 0) {
            return null;
        }

        let tooltipText: string;
        if (userIds.length === 1) {
            const username = UserStore.getUser(userIds[0])?.username ?? "Usuário";
            tooltipText = `Coleira ativa em ${username}`;
        } else {
            const names = userIds.slice(0, 3).map(id => UserStore.getUser(id)?.username ?? "?").join(", ");
            const extra = userIds.length > 3 ? ` e mais ${userIds.length - 3}` : "";
            tooltipText = `Coleira ativa em ${userIds.length} usuários: ${names}${extra}`;
        }
        tooltipText += " (clique para puxar, botão direito para soltar todos)";

        return (
            <HeaderBarIcon
                tooltip={tooltipText}
                icon={LeashIcon}
                onClick={() => {
                    void summonLeashedUsers(undefined, { reason: "manual" });
                }}
                onContextMenu={() => {
                    setLeashedUserIds([]);
                    showToast("Todas as coleiras removidas", Toasts.Type.SUCCESS);
                }}
            />
        );
    },

    addIconToToolBar(e: { toolbar: React.ReactNode[] | React.ReactNode; }) {
        if (Array.isArray(e.toolbar)) {
            e.toolbar.unshift(
                <ErrorBoundary noop={true} key="coleria-indicator">
                    <this.ColeiraIndicator />
                </ErrorBoundary>
            );
            return;
        }

        e.toolbar = [
            <ErrorBoundary noop={true} key="coleria-indicator">
                <this.ColeiraIndicator />
            </ErrorBoundary>,
            e.toolbar
        ];
    }
});

