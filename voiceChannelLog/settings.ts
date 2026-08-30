/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";

const settings = definePluginSettings({
    logJoinLeave: {
        type: OptionType.BOOLEAN,
        description: "Registrar quando usuários entram, saem ou mudam de canal de voz.",
        default: true
    },
    showNotifications: {
        type: OptionType.BOOLEAN,
        description: "Exibir notificações pop-up na tela com eventos em tempo real da chamada.",
        default: true
    },
    notificationPosition: {
        type: OptionType.SELECT,
        description: "Posição dos pop-ups de notificação na tela.",
        options: [
            { label: "Inferior Direito", value: "bottom-right", default: true },
            { label: "Superior Direito", value: "top-right" },
            { label: "Inferior Esquerdo", value: "bottom-left" },
            { label: "Superior Esquerdo", value: "top-left" },
        ],
    },
    logSelfMuteDeafen: {
        type: OptionType.BOOLEAN,
        description: "Registrar quando usuários mutam/desmutam ou ensurdecem/desensurdecem a si mesmos.",
        default: true
    },
    logMuteDeafen: {
        type: OptionType.BOOLEAN,
        description: "Registrar quando usuários são mutados ou ensurdecidos pelo servidor/moderadores.",
        default: true
    },
    logVideo: {
        type: OptionType.BOOLEAN,
        description: "Registrar quando usuários ligam ou desligam a câmera (vídeo).",
        default: true
    },
    logStream: {
        type: OptionType.BOOLEAN,
        description: "Registrar quando usuários iniciam ou encerram transmissões de tela (compartilhamento).",
        default: true
    },
    logSoundboard: {
        type: OptionType.BOOLEAN,
        description: "Registrar quando usuários tocam efeitos sonoros no Soundboard.",
        default: true
    },
    logActivity: {
        type: OptionType.BOOLEAN,
        description: "Registrar quando usuários iniciam ou encerram atividades/jogos integrados.",
        default: true
    },
    autoSaveJson: {
        type: OptionType.BOOLEAN,
        description: "Salvar automaticamente o histórico de logs no armazenamento local para não perder nada entre reinicializações.",
        default: true
    },
    ignoreBlockedUsers: {
        type: OptionType.BOOLEAN,
        description: "Ignorar e não registrar eventos de usuários bloqueados.",
        default: false
    },
    soundboardFileType: {
        type: OptionType.SELECT,
        description: "Formato do arquivo ao baixar áudios do Soundboard.",
        options: [
            { label: ".ogg", value: ".ogg", default: true },
            { label: ".mp3", value: ".mp3" },
            { label: ".wav", value: ".wav" },
        ],
    },
    soundboardVolume: {
        type: OptionType.SLIDER,
        description: "Volume de pré-visualização dos sons do soundboard (0 para desativar).",
        default: 0.5,
        markers: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]
    },
});

export default settings;
