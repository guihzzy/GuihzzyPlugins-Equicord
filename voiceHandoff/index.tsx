import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import { definePluginSettings } from "@api/Settings";
import { Notice } from "@components/Notice";
import definePlugin, { OptionType } from "@utils/types";
import { User, VoiceState } from "@vencord/discord-types";
import { findByPropsLazy } from "@webpack";
import { Menu, React, UserStore, VoiceStateStore, SelectedChannelStore } from "@webpack/common";

let markedUserId: string | null = null;
let lastMyChannelId: string | null = null;

const voiceChannelAction = findByPropsLazy("selectVoiceChannel");

const settings = definePluginSettings({
    onlySameCall: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Apenas conectar se o usuário marcado estiver na mesma call que você acabou de sair."
    }
});

const UserContextMenuPatch: NavContextMenuPatchCallback = (children, { user }: { user: User }) => {
    if (UserStore.getCurrentUser()?.id === user.id) return;

    const [checked, setChecked] = React.useState(markedUserId === user.id);

    children.push(
        <Menu.MenuSeparator />,
        <Menu.MenuCheckboxItem
            id="vh-handoff-user"
            label="Marcar para Auto Connect (Mobile -> PC)"
            checked={checked}
            action={() => {
                if (markedUserId === user.id) {
                    markedUserId = null;
                    setChecked(false);
                    return;
                }
                markedUserId = user.id;
                setChecked(true);
            }}
        ></Menu.MenuCheckboxItem>
    );
};

export default definePlugin({
    name: "VoiceHandoff",
    description: "Conecta automaticamente o seu PC na call do usuário marcado quando você se desconecta de outro client (ex: mobile).",
    tags: ["Voice"],
    authors: [],
    settings,
    settingsAboutComponent: () => (
        <Notice.Info>
            Clique com o botão direito em um usuário para marcá-lo para Auto Connect. Quando você sair de uma call pelo celular, o seu PC conectará automaticamente se o usuário marcado ainda estiver na call.
        </Notice.Info>
    ),
    flux: {
        async VOICE_STATE_UPDATES({ voiceStates }: { voiceStates: VoiceState[]; }) {
            const myId = UserStore.getCurrentUser()?.id;
            if (!myId) return;

            const pcChannelId = SelectedChannelStore.getVoiceChannelId();
            
            voiceStates.forEach(voiceState => {
                if (voiceState.userId === myId) {
                    // Verifica se desconectamos de um client não-PC (ex: mobile)
                    if (!voiceState.channelId && pcChannelId === null && lastMyChannelId) {
                        if (markedUserId) {
                            const markedUserState = VoiceStateStore.getVoiceStateForUser(markedUserId);
                            if (markedUserState?.channelId) {
                                // Conectar se as configurações permitirem
                                if (!settings.store.onlySameCall || markedUserState.channelId === lastMyChannelId) {
                                    voiceChannelAction.selectVoiceChannel(markedUserState.channelId);
                                }
                            }
                        }
                    }
                    // Atualiza o último canal global conhecido
                    lastMyChannelId = voiceState.channelId ?? null;
                }
            });
        }
    },
    contextMenus: {
        "user-context": UserContextMenuPatch
    },
    start() {
        const myId = UserStore.getCurrentUser()?.id;
        if (myId) {
            const myState = VoiceStateStore.getVoiceStateForUser(myId);
            if (myState?.channelId) {
                lastMyChannelId = myState.channelId;
            }
        }
    }
});
