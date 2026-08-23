/*
 * Equicord, a Discord client mod
 * Copyright (c) 2026 Equicord and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { EquicordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { ChannelType } from "@vencord/discord-types/enums";
import {
    ChannelStore,
    SelectedChannelStore,
    UserStore
} from "@webpack/common";

import { showDMGroupNotification } from "./components/DMGroupNotification";

const settings = definePluginSettings({
    notifyOnMention: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Notificar quando alguém te mencionar diretamente"
    },
    notifyOnEveryone: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Notificar em menções de @everyone e @here"
    },
    showInActive: {
        type: OptionType.BOOLEAN,
        default: false,
        description: "Mostrar notificações mesmo para o canal ativo no momento"
    }
});

export default definePlugin({
    name: "DMGroupsNotification",
    description: "Notifica você quando for mencionado/marcado em DMs de Grupo, permitindo clicar para ir até a mensagem.",
    tags: ["Chat", "Notifications"],
    authors: [EquicordDevs.nyx],
    settings,

    flux: {
        MESSAGE_CREATE({ message }: { message: any }) {
            try {
                if (!message?.channel_id || message.state === "SENDING") return;

                const channel = ChannelStore.getChannel(message.channel_id);
                const currentUser = UserStore.getCurrentUser();

                if (!channel || !currentUser) return;
                if (message.author?.id === currentUser.id) return;

                // Check if it is a Group DM
                if (channel.type !== ChannelType.GROUP_DM) return;

                // Check active channel condition
                if (!settings.store.showInActive && channel.id === SelectedChannelStore.getChannelId()) return;

                let shouldNotify = false;

                // Check direct mention
                if (settings.store.notifyOnMention && message.mentions?.some((u: any) => u.id === currentUser.id)) {
                    shouldNotify = true;
                }
                
                // Check everyone/here mention
                if (settings.store.notifyOnEveryone && message.mention_everyone) {
                    shouldNotify = true;
                }

                if (shouldNotify) {
                    showDMGroupNotification(message, channel);
                }
            } catch (err) {
                console.error("[DMGroupsNotification] Error:", err);
            }
        }
    }
});
