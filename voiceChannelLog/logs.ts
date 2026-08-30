/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { Channel } from "@vencord/discord-types";
import { UserStore } from "@webpack/common";

import settings from "./settings";
import { VoiceChannelLogEntry } from "./types";

const STORAGE_KEY = "EQUI_VOICE_CHANNEL_LOGS_V1";
const MAX_LOGS_PER_CHANNEL = 500;

function loadStoredLogs(): Map<string, VoiceChannelLogEntry[]> {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return new Map();
        const parsed = JSON.parse(raw);
        const map = new Map<string, VoiceChannelLogEntry[]>();
        for (const [chId, entries] of Object.entries(parsed)) {
            if (Array.isArray(entries)) {
                map.set(chId, entries.map((e: any) => ({
                    ...e,
                    timestamp: new Date(e.timestamp)
                })));
            }
        }
        return map;
    } catch {
        return new Map();
    }
}

function persistLogs(map: Map<string, VoiceChannelLogEntry[]>) {
    if (!settings.store.autoSaveJson) return;
    try {
        const obj: Record<string, any[]> = {};
        for (const [chId, entries] of map.entries()) {
            obj[chId] = entries.slice(-MAX_LOGS_PER_CHANNEL);
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
    } catch (err) {
        console.error("[VoiceChannelLog] Erro ao persistir logs no localStorage:", err);
    }
}

const vcLogs = loadStoredLogs();
let vcLogSubscriptions: (() => void)[] = [];

let callStartTime: Date | null = null;

export function getCallStartTime(): Date | null {
    return callStartTime;
}

export function setCallStartTime(time: Date | null) {
    callStartTime = time;
}

const EMPTY_LOGS: VoiceChannelLogEntry[] = [];

export function getVcLogs(channelId?: string): VoiceChannelLogEntry[] {
    if (!channelId) return EMPTY_LOGS;
    return vcLogs.get(channelId) ?? EMPTY_LOGS;
}

export function addLogEntry(entry: VoiceChannelLogEntry) {
    const existing = vcLogs.get(entry.channelId) ?? [];
    const updated = [...existing, entry].slice(-MAX_LOGS_PER_CHANNEL);
    vcLogs.set(entry.channelId, updated);
    persistLogs(vcLogs);
    vcLogSubscriptions.forEach(fn => fn());
}

export function clearLogs(channelId?: string) {
    if (!channelId) return;
    vcLogs.set(channelId, []);
    persistLogs(vcLogs);
    vcLogSubscriptions.forEach(fn => fn());
}

export function vcLogSubscribe(listener: () => void) {
    vcLogSubscriptions = [...vcLogSubscriptions, listener];
    return () => {
        vcLogSubscriptions = vcLogSubscriptions.filter(l => l !== listener);
    };
}

export function exportLogsToJson(channel: Channel) {
    const logs = getVcLogs(channel.id);
    const data = {
        plugin: "VoiceChannelLog",
        canal_id: channel.id,
        canal_nome: channel.name ?? "Canal de Voz",
        servidor_id: channel.guild_id ?? null,
        data_exportacao: new Date().toISOString(),
        total_registros: logs.length,
        registros: logs.map(l => {
            const u = UserStore.getUser(l.userId);
            return {
                tipo: l.type,
                usuario_id: l.userId,
                usuario_nome: u?.username ?? "Desconhecido",
                usuario_global: u?.globalName ?? null,
                canal_id: l.channelId,
                canal_antigo_id: l.oldChannelId ?? null,
                canal_novo_id: l.newChannelId ?? null,
                ativo: l.enabled ?? null,
                atividade: l.activityName ?? null,
                aplicacao_id: l.applicationId ?? null,
                som_id: l.soundId ?? null,
                data_hora: l.timestamp instanceof Date ? l.timestamp.toISOString() : l.timestamp,
                data_hora_local: l.timestamp instanceof Date ? l.timestamp.toLocaleString("pt-BR") : l.timestamp
            };
        })
    };

    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const cleanName = (channel.name || channel.id).replace(/[^\w\d-]/g, "_");
    a.download = `voice-logs-${cleanName}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
