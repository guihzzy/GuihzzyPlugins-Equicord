/*
 * Vencord, a Discord client mod
 * Copyright (c) 2023 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { classes } from "@utils/misc";
import { Channel, RenderModalProps } from "@vencord/discord-types";
import { AccessibilityStore, Modal, openModal, React, ScrollerThin } from "@webpack/common";

import { clearLogs, exportLogsToJson, getVcLogs, vcLogSubscribe } from "../logs";
import { cl } from "../utils";
import { VoiceChannelLogEntryComponent } from "./VoiceChannelLogEntryComponent";

export function openVoiceChannelLog(channel: Channel) {
    return openModal(props => (
        <VoiceChannelLogModal props={props} channel={channel} />
    ));
}

export function VoiceChannelLogModal({ channel, props }: { channel: Channel; props: RenderModalProps; }) {
    const logs = React.useSyncExternalStore(vcLogSubscribe, () => getVcLogs(channel.id));

    return (
        <Modal
            {...props}
            size="lg"
            title={`Logs de Voz: ${channel.name ?? "Canal de Voz"}`}
            actions={[
                {
                    text: "Exportar Logs (.json)",
                    variant: "primary",
                    onClick: () => exportLogsToJson(channel)
                },
                {
                    text: "Limpar logs",
                    variant: "dangerPrimary",
                    onClick: () => clearLogs(channel.id)
                }
            ]}
        >
            <ScrollerThin fade className={classes(cl("scroller"), `group-spacing-${AccessibilityStore.messageGroupSpacing}`)}>
                {logs.length > 0 ? logs.map((entry, i) => {
                    const elements: React.ReactNode[] = [];
                    const dateStr = entry.timestamp.toLocaleDateString("pt-BR", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric"
                    });
                    const prevDateStr = i > 0 ? logs[i - 1].timestamp.toLocaleDateString("pt-BR", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric"
                    }) : null;

                    if (i === 0 || dateStr !== prevDateStr) {
                        elements.push(
                            <div key={`sep-${i}`} className={cl("date-separator")} role="separator" aria-label={dateStr}>
                                <span>{dateStr}</span>
                            </div>
                        );
                    }

                    elements.push(
                        <VoiceChannelLogEntryComponent key={`entry-${i}`} logEntry={entry} channel={channel} />
                    );

                    return elements;
                }) : (
                    <div className={cl("empty")}>Nenhum registro de voz para exibir.</div>
                )}
            </ScrollerThin>
        </Modal>
    );
}
