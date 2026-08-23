# Plugin FakeDeafen

## 📝 Descrição
O **FakeDeafen** é um plugin que intercepta os pacotes do WebSocket do Discord para fazer parecer que você está surdo para outros usuários, enquanto na verdade você ainda pode ouvir tudo normalmente. Isso é útil quando você quer parecer offline ou indisponível, mas ainda precisa ouvir o que está acontecendo no canal de voz.

> ⚠️ **Atenção:** Este plugin modifica o comportamento do WebSocket do Discord. Use com responsabilidade.

## ✨ Funcionalidades
- 🎭 **Surdez Falsa**: Finge que você está surdo para outros usuários
- 🔊 **Áudio Preservado**: Você ainda pode ouvir o áudio normalmente
- 🔔 **Notificações**: Avisa quando o modo fake deafen é ativado/desativado
- 🔌 **Interceptação WebSocket**: Intercepta pacotes do WebSocket para manter o estado de "surdo"
- 🛡️ **Proteção Automática**: Bloqueia pacotes que tentam desativar a surdez

## 🚀 Como Usar
1. **Ative o plugin**: Vá em **Configurações de Usuário > Vencord > Plugins** e ative o **FakeDeafen**.
2. **Entre em um canal de voz**: Conecte-se a qualquer canal de voz no Discord.
3. **Ative a surdez**: Use o atalho padrão do Discord (Ctrl+Shift+D) ou clique no botão de surdez no painel de voz.
4. **Mantenha-se "surdo"**: O plugin automaticamente interceptará os pacotes e manterá você "surdo" visualmente, mas ainda audível para você.

## ⚙️ Como Funciona

O plugin funciona interceptando os pacotes do WebSocket que o Discord envia quando você tenta desativar a surdez. Quando você ativa a surdez, o plugin:

1. Sobrescreve o método `send` do `WebSocket.prototype`
2. Filtra pacotes que tentam desativar a surdez (`self_deaf: false`)
3. Descarta esses pacotes, mantendo você "surdo" para outros usuários
4. Permite que todos os outros pacotes passem normalmente

> ⚠️ **Nota:** O plugin pode não funcionar se o Discord mudar a estrutura dos pacotes em atualizações futuras.

## 🛠️ Instalação

### Pré-requisitos
Você precisa ter o **Vencord** instalado via código-fonte (não a versão `.exe`).

1. **Abra a pasta de plugins do Vencord:**
   Geralmente em: `Documentos/Vencord/src/plugins` ou `Documentos/Equicord/src/plugins`

2. **Crie a pasta do plugin:**
   Crie uma pasta chamada `fakeDeafen` dentro de `plugins`.

3. **Adicione os arquivos:**
   Coloque o arquivo `index.ts` dentro da pasta `fakeDeafen`.

4. **Recompile o Vencord:**
   Abra o terminal na pasta do Vencord e execute:
   ```sh
   pnpm build
   ```

5. **Ative no Discord:**
   - Reinicie o Discord.
   - Vá em **Configurações de Usuário > Vencord > Plugins**.
   - Procure por `FakeDeafen` e ative.

## 📝 Licença
Este plugin é parte do ecossistema Vencord e está licenciado sob **GPL-3.0-or-later**.

---

<p align="center">Feito com ❤️ por <b>Guih</b></p>

