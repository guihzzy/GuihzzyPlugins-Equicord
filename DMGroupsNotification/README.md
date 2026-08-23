# DMGroupsNotification

O **DMGroupsNotification** é um plugin para Equicord/Vencord que exibe notificações visuais elegantes em forma de card (toasts) sempre que você for mencionado em grupos de mensagens diretas (Group DMs).

Ele permite que você acompanhe rapidamente quando alguém fala diretamente com você ou marca o grupo, com a praticidade de pular direto para a mensagem com um único clique.

---

## Funcionalidades

- 💬 **Notificação Interativa:** Exibe um card moderno no canto inferior direito contendo o autor, avatar, status da menção, horário e prévia formatada do texto.
- 🎯 **Salto Rápido:** Clique em qualquer lugar do card para ser redirecionado imediatamente para a mensagem no grupo correspondente.
- 👤 **Acesso ao Perfil:** Clique no avatar ou no nome do autor para abrir o perfil do usuário diretamente.
- 🎨 **Status Diferenciados:** Indicadores visuais e cores distintas para menções diretas (roxo) e menções gerais (`@everyone` / `@here`, laranja).
- ⏱️ **Auto-dismiss Inteligente:** O card fecha automaticamente após 5 segundos, mas a barra de progresso pausa enquanto você estiver com o mouse em cima.
- ❌ **Botão de Fechar:** Fechamento rápido a qualquer momento.

---

## Configurações

Nas opções do plugin dentro das configurações do Equicord, você pode personalizar:

- **Notificar quando alguém te mencionar diretamente:**
  - *Ativado (Padrão):* Exibe a notificação sempre que seu usuário for marcado em um grupo.
- **Notificar em menções de @everyone e @here:**
  - *Ativado (Padrão):* Exibe a notificação quando alguém utilizar menções globais no grupo.
- **Mostrar notificações mesmo para o canal ativo no momento:**
  - *Desativado (Padrão):* Não exibe notificações se você já estiver visualizando o canal no momento em que a mensagem for enviada.
  - *Ativado:* Exibe a notificação em todas as ocasiões, mesmo na conversa aberta.

---

## Instalação

1. Copie a pasta `DMGroupsNotification` para dentro do seu diretório de plugins do Equicord (`src/equicordplugins/`).
2. Faça a build do client normalmente ou reinicie o Equicord caso esteja usando em modo de desenvolvimento.
3. Ative o **DMGroupsNotification** nas configurações de plugins.

---

<p align="center">Feito com ❤️ por <b>Guih</b></p>
