/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import { definePluginSettings, useSettings } from "@api/Settings";
import ErrorBoundary from "@components/ErrorBoundary";
import { Devs } from "@utils/constants";
import { classes } from "@utils/misc";
import definePlugin, { OptionType } from "@utils/types";
import { findByPropsLazy, findComponentByCodeLazy, findStoreLazy } from "@webpack";
import {
    ChannelStore,
    Menu,
    PermissionsBits,
    PermissionStore,
    React,
    SelectedChannelStore,
    Toasts,
    UserStore
} from "@webpack/common";
import type { Channel, User } from "discord-types/general";
import type { PropsWithChildren, SVGProps } from "react";

const HeaderBarIcon = findComponentByCodeLazy(".HEADER_BAR_BADGE_TOP:", '.iconBadge,"top"');

interface BaseIconProps extends IconProps {
    viewBox: string;
}

interface IconProps extends SVGProps<SVGSVGElement> {
    className?: string;
    height?: string | number;
    width?: string | number;
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

function FollowIcon(props: IconProps) {
    return (
        <Icon
            {...props}
            className={classes(props.className, "vc-follow-icon")}
            viewBox="0 -960 960 960"
        >
            <path
                fill="currentColor"
                d="m480-120-58-52q-101-91-167-157T150-447.5Q111-500 95.5-544T80-634q0-94 63-157t157-63q52 0 99 22t81 62q34-40 81-62t99-22q94 0 157 63t63 157q0 46-15.5 90T810-447.5Q771-395 705-329T538-172l-58 52Zm0-108q96-86 158-147.5t98-107q36-45.5 50-81t14-70.5q0-60-40-100t-100-40q-47 0-87 26.5T518-680h-76q-15-41-55-67.5T300-774q-60 0-100 40t-40 100q0 35 14 70.5t50 81q36 45.5 98 107T480-228Zm0-273Z"
            />
        </Icon>
    );
}

function UnfollowIcon(props: IconProps) {
    return (
        <Icon
            {...props}
            className={classes(props.className, "vc-unfollow-icon")}
            viewBox="0 -960 960 960"
        >
            <path
                fill="currentColor"
                d="m480-120-58-52q-101-91-167-157T150-447.5Q111-500 95.5-544T80-634q0-94 63-157t157-63q52 0 99 22t81 62q34-40 81-62t99-22q94 0 157 63t63 157q0 46-15.5 90T810-447.5Q771-395 705-329T538-172l-58 52Z"
            />
        </Icon>
    );
}

interface VoiceState {
    userId: string;
    channelId?: string;
    oldChannelId?: string;
    deaf: boolean;
    mute: boolean;
    selfDeaf: boolean;
    selfMute: boolean;
    selfStream: boolean;
    selfVideo: boolean;
    sessionId: string;
    suppress: boolean;
    requestToSpeakTimestamp: string | null;
}

export const settings = definePluginSettings({
    executeOnFollow: {
        type: OptionType.BOOLEAN,
        description: "Certifique-se de estar no mesmo canal de voz ao seguir um usuário",
        restartNeeded: false,
        default: true
    },
    onlyManualTrigger: {
        type: OptionType.BOOLEAN,
        description: "Apenas ativar ao clicar no indicador",
        restartNeeded: false,
        default: false
    },
    followLeave: {
        type: OptionType.BOOLEAN,
        description: "Também sair quando o usuário seguido sair",
        restartNeeded: false,
        default: false
    },
    autoMoveBack: {
        type: OptionType.BOOLEAN,
        description: "Automaticamente voltar para o canal de voz do usuário seguido quando você for movido",
        restartNeeded: false,
        default: false
    },
    followUserId: {
        type: OptionType.STRING,
        description: "ID do Usuário Seguido",
        restartNeeded: false,
        hidden: true, // Gerenciado via menu de contexto e indicador
        default: "",
    },
    channelFull: {
        type: OptionType.BOOLEAN,
        description: "Tentar mover você para o canal quando não estiver mais cheio",
        restartNeeded: false,
        default: true,
    }
});

const ChannelActions: {
    disconnect: () => void;
    selectVoiceChannel: (channelId: string) => void;
} = findByPropsLazy("disconnect", "selectVoiceChannel");

const VoiceStateStore: VoiceStateStore = findStoreLazy("VoiceStateStore");
const CONNECT = 1n << 20n;

interface VoiceStateStore {
    getAllVoiceStates(): VoiceStateEntry;
    getVoiceStatesForChannel(channelId: string): VoiceStateMember;
}

interface VoiceStateEntry {
    [guildIdOrMe: string]: VoiceStateMember;
}

interface VoiceStateMember {
    [userId: string]: VoiceState;
}

function getChannelId(userId: string) {
    if (!userId) {
        return null;
    }
    try {
        const states = VoiceStateStore.getAllVoiceStates();
        for (const users of Object.values(states)) {
            if (users[userId]) {
                return users[userId].channelId ?? null;
            }
        }
    } catch (e) { }
    return null;
}

function triggerFollow(userChannelId: string | null = getChannelId(settings.store.followUserId)) {
    if (settings.store.followUserId) {
        const myChanId = SelectedChannelStore.getVoiceChannelId();
        if (userChannelId) {
            // entrar quando não estiver no mesmo canal
            if (userChannelId !== myChanId) {
                const channel = ChannelStore.getChannel(userChannelId);
                const voiceStates = VoiceStateStore.getVoiceStatesForChannel(userChannelId);
                const memberCount = voiceStates ? Object.keys(voiceStates).length : null;
                if (channel.type === 1 || PermissionStore.can(CONNECT, channel)) {
                    if (channel.userLimit !== 0 && memberCount !== null && memberCount >= channel.userLimit && !PermissionStore.can(PermissionsBits.MOVE_MEMBERS, channel)) {
                        Toasts.show({
                            message: "Canal está cheio",
                            id: Toasts.genId(),
                            type: Toasts.Type.FAILURE
                        });
                        return;
                    }
                    ChannelActions.selectVoiceChannel(userChannelId);
                    Toasts.show({
                        message: "Seguiu o usuário para um novo canal de voz",
                        id: Toasts.genId(),
                        type: Toasts.Type.SUCCESS
                    });
                } else {
                    Toasts.show({
                        message: "Permissões insuficientes para entrar no canal de voz",
                        id: Toasts.genId(),
                        type: Toasts.Type.FAILURE
                    });
                }
            } else {
                Toasts.show({
                    message: "Você já está no mesmo canal",
                    id: Toasts.genId(),
                    type: Toasts.Type.FAILURE
                });
            }
        } else if (myChanId) {
            // Corrigido: se o usuário seguido não está em nenhum canal e você está em um canal
            if (settings.store.followLeave) {
                ChannelActions.disconnect();
                Toasts.show({
                    message: "Usuário seguido saiu, desconectado",
                    id: Toasts.genId(),
                    type: Toasts.Type.SUCCESS
                });
            } else {
                Toasts.show({
                    message: "Usuário seguido saiu, mas não seguindo desconexão",
                    id: Toasts.genId(),
                    type: Toasts.Type.FAILURE
                });
            }
        } else {
            Toasts.show({
                message: "Usuário seguido não está em um canal de voz",
                id: Toasts.genId(),
                type: Toasts.Type.FAILURE
            });
        }
    }
}

function toggleFollow(userId: string) {
    if (settings.store.followUserId === userId) {
        settings.store.followUserId = "";
    } else {
        settings.store.followUserId = userId;
        if (settings.store.executeOnFollow) {
            triggerFollow();
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
    const isFollowed = settings.store.followUserId === user.id;
    const label = isFollowed ? "Deixar de Seguir Usuário" : "Seguir Usuário";
    const icon = isFollowed ? UnfollowIcon : FollowIcon;

    children.splice(-1, 0, (
        <Menu.MenuGroup>
            <Menu.MenuItem
                id="follow-user"
                label={label}
                action={() => toggleFollow(user.id)}
                icon={icon}
            />
        </Menu.MenuGroup>
    ));
};

// Adicione esta função para monitorar quando o usuário seguido sai
function checkAndHandleUserLeave(userId: string, channelId: string | undefined, oldChannelId: string | undefined) {
    // Se o usuário seguido saiu de um canal e não entrou em outro
    if (settings.store.followUserId === userId && oldChannelId && !channelId) {
        if (settings.store.followLeave && SelectedChannelStore.getVoiceChannelId()) {
            ChannelActions.disconnect();
            Toasts.show({
                message: "Usuário seguido saiu, desconectado",
                id: Toasts.genId(),
                type: Toasts.Type.SUCCESS
            });
        }
    }
}

export default definePlugin({
    name: "FollowUser",
    description: "Adiciona uma opção de seguir no menu de contexto do usuário para sempre estar no mesmo canal de voz que ele",
    authors: [Devs.Guih],

    settings,

    start() {
        // Resetar o usuário seguido na inicialização do client para não manter o estado entre diferentes clients/sessões
        settings.store.followUserId = "";
    },

    stop() {
        settings.store.followUserId = "";
    },

    patches: [
        {
            find: "toolbar:function",
            replacement: {
                match: /(function \i\(\i\){)(.{1,200}toolbar.{1,100}mobileToolbar)/,
                replace: "$1$self.addIconToToolBar(arguments[0]);$2"
            }
        },
    ],

    contextMenus: {
        "user-context": UserContext
    },

    flux: {
        VOICE_STATE_UPDATES({ voiceStates }: { voiceStates: VoiceState[]; }) {
            if (settings.store.onlyManualTrigger || !settings.store.followUserId) {
                return;
            }
            for (const { userId, channelId, oldChannelId } of voiceStates) {
                if (channelId !== oldChannelId) {
                    const isMe = userId === UserStore.getCurrentUser().id;
                    
                    // Verificar explicitamente se o usuário seguido saiu
                    if (!isMe && userId === settings.store.followUserId && oldChannelId && !channelId) {
                        checkAndHandleUserLeave(userId, channelId, oldChannelId);
                        continue;
                    }
                    
                    // Se você foi desconectado e estava no mesmo canal que o usuário seguido, reconectar
                    if (isMe && oldChannelId && !channelId) {
                        const followedUserChannelId = getChannelId(settings.store.followUserId);
                        // Se estava no mesmo canal que o usuário seguido e ele ainda está em um canal
                        if (followedUserChannelId && oldChannelId === followedUserChannelId) {
                            triggerFollow(followedUserChannelId);
                            continue;
                        }
                    }
                    
                    // voltar se a configuração estiver ativada e você foi movido
                    if (settings.store.autoMoveBack && isMe && channelId && oldChannelId) {
                        triggerFollow();
                        continue;
                    }

                    // se você não está no canal do usuário seguido e ele não está mais cheio, entrar
                    if (settings.store.channelFull && !isMe && !channelId && oldChannelId && oldChannelId !== SelectedChannelStore.getVoiceChannelId()) {
                        const channel = ChannelStore.getChannel(oldChannelId);
                        const channelVoiceStates = VoiceStateStore.getVoiceStatesForChannel(oldChannelId);
                        const memberCount = channelVoiceStates ? Object.keys(channelVoiceStates).length : null;
                        if (channel.userLimit !== 0 && memberCount !== null && memberCount === (channel.userLimit - 1) && !PermissionStore.can(PermissionsBits.MOVE_MEMBERS, channel)) {
                            const users = Object.values(channelVoiceStates).map(x => x.userId);
                            if (users.includes(settings.store.followUserId)) {
                                triggerFollow(oldChannelId);
                                continue;
                            }
                        }
                    }

                    const isFollowed = settings.store.followUserId === userId;
                    if (!isFollowed) {
                        continue;
                    }

                    if (channelId) {
                        // mover ou entrar em novo canal -> também entrar
                        triggerFollow(channelId);
                    } else if (oldChannelId) {
                        // sair -> desconectar
                        triggerFollow(null);
                    }
                }
            }
        },
    },

    FollowIndicator() {
        const { plugins: { FollowUser: { followUserId } } } = useSettings(["plugins.FollowUser.followUserId"]);
        if (followUserId) {
            return (
                <HeaderBarIcon
                    tooltip={`Seguindo ${UserStore.getUser(followUserId).username} (clique para ativar manualmente, clique com botão direito para deixar de seguir)`}
                    icon={UnfollowIcon}
                    onClick={() => {
                        triggerFollow();
                    }}
                    onContextMenu={() => {
                        settings.store.followUserId = "";
                    }}
                />
            );
        }

        return null;
    },

    addIconToToolBar(e: { toolbar: React.ReactNode[] | React.ReactNode; }) {
        if (Array.isArray(e.toolbar)) {
            return e.toolbar.unshift(
                <ErrorBoundary noop={true} key="follow-indicator">
                    <this.FollowIndicator/>
                </ErrorBoundary>
            );
        }

        e.toolbar = [
            <ErrorBoundary noop={true} key="follow-indicator">
                <this.FollowIndicator />
            </ErrorBoundary>,
            e.toolbar,
        ];
    },
});
