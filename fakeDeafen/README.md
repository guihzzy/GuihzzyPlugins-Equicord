# Plugin FakeDeafen

## 📝 Descrição
O **FakeDeafen** é um plugin que faz parecer que você está surdo para outros usuários na call, enquanto você continua ouvindo e falando normalmente. Os botões de microfone e áudio ficam como se você estivesse ativo, mas os outros veem o ícone de surdo.

> ⚠️ **Atenção:** Este plugin modifica o comportamento do WebSocket do Discord. Use com responsabilidade.

## ✨ Funcionalidades
- 🎭 **Surdez Falsa**: Outros usuários veem você como surdo na call
- 🔊 **Áudio Preservado**: Você continua ouvindo e falando normalmente — os botões de mute/deafen ficam normais
- 🔘 **Botão Toggle**: Botão dedicado ao lado dos controles de voz — um clique para ativar, um clique para desativar
- 🔔 **Notificações**: Avisa quando o Fake Deafen é ativado/desativado
- 🔌 **Interceptação WebSocket**: Bloqueia pacotes `self_deaf: false` para manter o estado no servidor
- 🛡️ **Proteção do Botão Nativo**: Se clicar no botão de deafen nativo do Discord enquanto o fake está ativo, o estado é restaurado automaticamente
- 🔇 **Preservação do Mute**: O estado do mute do microfone é preservado ao ativar/desativar o fake deafen

## 🚀 Como Usar
1. **Ative o plugin**: Vá em **Configurações de Usuário > Vencord > Plugins** e ative o **FakeDeafen**.
2. **Entre em um canal de voz**: Conecte-se a qualquer canal de voz no Discord.
3. **Clique no botão Fake Deafen**: Um botão de headphones aparecerá ao lado dos botões de mute/deafen na barra de controle de voz. Clique para ativar.
4. **Desative quando quiser**: Clique no mesmo botão novamente para voltar ao normal.

### Estados do Botão
| Estado | Aparência do Botão | Significado |
|--------|-------------------|-------------|
| Desativado | Ícone de headphones normal | Estado normal, sem fake deafen |
| Ativado | Ícone de headphones com risco vermelho + brilho vermelho | Você aparece como surdo para os outros, mas ouve normalmente |

## ⚙️ Como Funciona

O plugin usa a técnica de **double-toggle** para criar uma dessincronização entre o estado local e o estado do servidor:

### Ativando o Fake Deafen
1. Inicia a interceptação do WebSocket (bloqueia `self_deaf: false`)
2. Ativa o deafen via `toggleSelfDeaf()` → envia `self_deaf: true` pro servidor e muta localmente
3. Aguarda 150ms para o pacote ser enviado
4. Desativa o deafen localmente via `toggleSelfDeaf()` → tenta enviar `self_deaf: false` → **BLOQUEADO** pelo interceptor
5. Resultado: o servidor acha que você está surdo, mas localmente você ouve e fala normalmente

### Desativando o Fake Deafen
1. Para a interceptação do WebSocket
2. Faz o double-toggle reverso para enviar `self_deaf: false` pro servidor
3. Tudo volta ao normal

### Interceptação WebSocket
O plugin sobrescreve `WebSocket.prototype.send` e filtra:
- Pacotes JSON com `self_deaf: false` — descartados
- Pacotes ArrayBuffer contendo `self_deafs\x05false` — descartados
- Todos os outros pacotes — passam normalmente

> ⚠️ **Nota:** O plugin pode não funcionar se o Discord mudar a estrutura dos pacotes em atualizações futuras.

## 🛠️ Instalação

### Pré-requisitos
Você precisa ter o **Vencord** instalado via código-fonte (não a versão `.exe`).

1. **Abra a pasta de plugins do Vencord:**
   Geralmente em: `Documentos/Vencord/src/plugins` ou `Documentos/Equicord/src/plugins`

2. **Crie a pasta do plugin:**
   Crie uma pasta chamada `fakeDeafen` dentro de `plugins`.

3. **Adicione os arquivos:**
   Coloque o arquivo `index.tsx` dentro da pasta `fakeDeafen`.

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

Desenvolvido com ❤️ por **guihzzy**
