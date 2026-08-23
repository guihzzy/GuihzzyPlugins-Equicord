# Plugin ColeriaUser para Vencord

## 📝 Descrição
O **ColeriaUser** é o inverso do **FollowUser**: em vez de seguir alguém, você coloca uma "coleira" em um ou mais amigos e força que eles acompanhem todas as chamadas em que você entrar. Sempre que você mudar de canal de voz, o plugin tenta mover automaticamente os usuários marcados para o mesmo canal.

> ⚠️ **Atenção:** Este plugin requer que você tenha a permissão **Mover Membros** no servidor para funcionar.

## ✨ Funcionalidades
- 🔗 **Múltiplas Coleiras**: Marque quantos amigos quiser ao mesmo tempo
- 🖱️ **Menu de Contexto**: Adicione/Remova a coleira clicando com o botão direito no usuário
- 📌 **Indicador Visual**: Ícone na barra superior mostrando quantos usuários estão presos
- 🔄 **Movimento Automático**: Puxa todos os usuários presos assim que você entra em uma call
- 🛡️ **Proteção Anti-Fuga**: Se o usuário tentar sair enquanto você está em call, ele é puxado de volta
- 🚪 **Desconexão Sincronizada**: (Opcional) Desconecta os usuários quando você sai da call
- ⚡ **Cooldown Inteligente**: Evita spam de requisições ao servidor

## 🚀 Como Usar
1. **Marcar Usuário**: Clique com o botão direito sobre um usuário e selecione **Colocar Coleira**.
2. **Entrar em Call**: Entre em um canal de voz. Todos os usuários marcados (que estiverem em call no mesmo servidor) serão puxados para o seu canal.
3. **Gerenciar**:
   - **Clique esquerdo no ícone da coleira**: Tenta puxar manualmente os usuários.
   - **Clique direito no ícone da coleira**: Solta todos os usuários de uma vez.
   - **Hover no ícone**: Mostra a lista de quem está preso.

## ⚙️ Configurações
| Configuração | Descrição | Padrão |
|-------------|-----------|--------|
| **Mover automaticamente** | Puxa os usuários assim que você entrar/mover de canal | Ativado |
| **Reforçar durante a call** | Se o usuário tentar sair ou mudar de canal enquanto você ainda está em voz, ele é puxado de volta | Ativado |
| **Desconectar ao sair** | Quando você sai de todas as chamadas, os usuários com coleira também são desconectados | Desativado |

## 🛠️ Instalação

### Pré-requisitos
Você precisa ter o **Vencord** instalado via código-fonte (não a versão `.exe`).

1. **Abra a pasta de plugins do Vencord:**
   Geralmente em: `Documentos/Vencord/src/plugins`

2. **Crie a pasta do plugin:**
   Crie uma pasta chamada `ColeriaUser` dentro de `plugins`.

3. **Adicione os arquivos:**
   Coloque o arquivo `index.tsx` dentro da pasta `ColeriaUser`.

4. **Recompile o Vencord:**
   Abra o terminal na pasta do Vencord e execute:
   ```sh
   pnpm build
   ```

5. **Ative no Discord:**
   - Reinicie o Discord.
   - Vá em **Configurações de Usuário > Vencord > Plugins**.
   - Procure por `ColeriaUser` e ative.
   
---

<p align="center">Feito com ❤️ por <b>Guih</b></p>
