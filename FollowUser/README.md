# Plugin FollowUser para Vencord

## 📝 Descrição
Este plugin permite que você "siga" outros usuários em canais de voz no Discord. Quando você segue um usuário, o plugin automaticamente o move para o mesmo canal de voz que o usuário seguido quando ele muda de canal.

## ✨ Funcionalidades
- Adiciona uma opção "Seguir Usuário" no menu de contexto do usuário
- Mostra um indicador na barra de ferramentas quando você está seguindo alguém
- Automaticamente o move para o mesmo canal de voz que o usuário seguido
- Opção para desconectar quando o usuário seguido sai do canal de voz
- Opção para voltar automaticamente ao canal do usuário seguido se você for movido
- Tenta entrar no canal quando ele não estiver mais cheio

## 🚀 Como Usar
1. Clique com o botão direito em um usuário
2. Selecione "Seguir Usuário" no menu
3. Um ícone aparecerá na barra de ferramentas indicando que você está seguindo o usuário
4. Para parar de seguir, clique com o botão direito no ícone ou selecione "Deixar de Seguir Usuário" no menu de contexto

## ⚙️ Configurações
| Configuração | Descrição |
|-------------|-----------|
| **Entrar no mesmo canal ao seguir** | Automaticamente entra no canal de voz do usuário quando você começa a segui-lo |
| **Apenas ativar manualmente** | Só segue o usuário quando você clica no indicador, não automaticamente |
| **Sair quando o usuário sair** | Desconecta você do canal de voz quando o usuário seguido sair |
| **Voltar automaticamente** | Se você for movido para outro canal, volta automaticamente para o canal do usuário seguido |
| **Tentar entrar quando o canal não estiver cheio** | Se o canal estiver cheio, tenta entrar quando houver espaço |

## 🛠️ Instalação
### Instalando o Vencord pelo CMD
⚠️ **IMPORTANTE:** O Vencord deve ser instalado manualmente na pasta `Documentos`. Não use a versão instalada por executável!

Se você ainda não tem o Vencord instalado, siga estas etapas:

1. **Abra o CMD como Administrador**
   - Pressione `Win + R`, digite `cmd` e pressione `Enter`
   - Clique com o botão direito no `Prompt de Comando` e selecione `Executar como Administrador`

2. **Instale as dependências necessárias:**
   ```sh
   winget install --id Git.Git -e --source winget
   winget install --id OpenJS.NodeJS.LTS -e --source winget
   npm install -g pnpm
   ```
   Certifique-se de que todos estão adicionados ao PATH do sistema.

3. **Verifique a instalação:**
   ```sh
   git --version
   node --version
   pnpm --version
   ```
   Se todos retornarem uma versão válida, a instalação foi bem-sucedida.

4. **Navegue até a pasta `Documentos` e clone o repositório do Vencord:**
   ```sh
   cd %USERPROFILE%\Documents
   git clone https://github.com/Vendicated/Vencord
   ```

5. **Acesse a pasta clonada:**
   ```sh
   cd Vencord
   ```

6. **Instale as dependências do Vencord:**
   ```sh
   pnpm install --frozen-lockfile
   ```

7. **Compile o Vencord:**
   ```sh
   pnpm build
   ```

8. **Injete o Vencord no Discord:**
   ```sh
   pnpm inject
   ```

### Instalando o Plugin FollowUser
#### Adicionando o Plugin
1. **Abra a pasta do Vencord no seu explorador de arquivos** e navegue até `src/plugins`.
2. **Crie uma pasta chamada `FollowUser`, caso ela não exista**.
3. **Copie os arquivos do plugin para dentro da pasta `FollowUser`**.
4. **Recompile o Vencord para aplicar as mudanças:**
   ```sh
   pnpm build
   ```
5. **Ative o plugin nas configurações do Vencord** dentro do Discord.

## 📝 Licença
Este plugin é parte do Vencord e está licenciado sob GPL-3.0-or-later.

---

Criado com ❤️ por **guihzzy**

