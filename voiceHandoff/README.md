# VoiceHandoff

O **VoiceHandoff** é um plugin para Equicord/Vencord que permite uma transição perfeita das suas chamadas de voz entre o seu dispositivo móvel (ou outro client) e o seu PC. 

Quando você estiver em uma call pelo celular e decidir ir para o PC, basta sair da call no celular. O plugin no seu PC detectará a desconexão e se conectará automaticamente à mesma chamada, desde que você tenha marcado um usuário de referência na call.

## Como funciona?

1. Clique com o botão direito no perfil de um amigo ou usuário que você sabe que continuará na call.
2. Selecione a opção **"Marcar para Auto Connect (Mobile -> PC)"**.
3. Continue usando o celular. Quando você sair da call no celular, o seu Discord no PC automaticamente entrará na call em que aquele usuário marcado está.

## Configurações

Nas opções do plugin dentro das configurações do Equicord, você pode alterar o seguinte:

- **Apenas conectar se o usuário marcado estiver na mesma call:**
  - *Ativado (Padrão):* Garante que você só seja puxado para a call se o usuário que você marcou estava na mesma chamada de voz que você acabou de sair. (Impede reconexões acidentais caso você saia de uma call diferente).
  - *Desativado:* Ao sair de qualquer chamada no mobile, o seu PC vai imediatamente procurar em qual chamada o usuário marcado está e conectar nela.

## Instalação

Copie a pasta `voiceHandoff` para dentro do seu diretório de plugins do Equicord (`src/equicordplugins/`) e faça a build do client normalmente.

---

<p align="center">Feito com ❤️ por <b>Guih</b></p>
