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

const settings = definePluginSettings({
    notifyOnTransfer: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Exibir notificação quando a chamada for transferida para o PC."
    }
}).withPrivateSettings<{
    monitoredUsers?: string[];
}>();

function isDmOrGroupDm(channel: Channel | undefined): boolean {
    if (!channel || channel.guild_id) return false;
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

            for (const voiceState of voiceStates) {
                const { userId, channelId } = voiceState;
                const oldChannelId = voiceState.oldChannelId ?? lastUserChannels.get(userId);

                if (channelId) {
                    lastUserChannels.set(userId, channelId);
                } else {
                    lastUserChannels.delete(userId);
                }

                // Se quem saiu foi o próprio usuário atual, não executa nenhuma ação de transferência
                if (userId === myId) continue;

                // Apenas monitora se o CallKeeper estiver ativado para essa pessoa
                if (!monitoredUsers.includes(userId)) continue;

                // Detecta se a outra pessoa saiu da chamada
                const leftChannelId = (oldChannelId && !channelId)
                    ? oldChannelId
                    : (oldChannelId && channelId && oldChannelId !== channelId ? oldChannelId : null);

                if (!leftChannelId) continue;

                // Validação: A chamada precisa ser uma DM ou Group DM (ignora servidores)
                const channel = ChannelStore.getChannel(leftChannelId);
                if (!isDmOrGroupDm(channel)) continue;

                // Validação: Eu ainda estou conectado à mesma chamada pelo celular/outro client
                const myVoiceState = VoiceStateStore.getVoiceStateForUser(myId);
                if (myVoiceState?.channelId !== leftChannelId) continue;

                // Validação: Se você já estiver em call pelo PC/Desktop, não faz nada
                const pcVoiceChannelId = SelectedChannelStore.getVoiceChannelId();
                if (pcVoiceChannelId) continue;

                // Todas as condições atendidas: transferir conexão para o PC
                ChannelActions.selectVoiceChannel(leftChannelId);

                if (settings.store.notifyOnTransfer) {
                    showToast("CallKeeper: Chamada transferida para o PC.", Toasts.Type.SUCCESS);
                }
            }
        }
    },
    start() {
        lastUserChannels.clear();

        const myId = UserStore.getCurrentUser()?.id;
        if (myId) {
            const myState = VoiceStateStore.getVoiceStateForUser(myId);
            if (myState?.channelId) {
                lastUserChannels.set(myId, myState.channelId);
            }
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
    }
});
