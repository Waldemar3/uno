class MenuForRegistered extends Component('#menuMainSection'){
  constructor(){
    super();

    this.handlers = {
      click: {
        '#inviteFriendButton': e => this.inviteFriendButton(e),
      },
    }
  }
  init(){
    $('#room').html(this.useTemplate('EmptyRoom'));
  }

  inviteFriendButton(e){
    e.preventDefault();
    const { config, socket } = this.getState();
    const { ttl, textInfo, nicknameLength } = config;
    const { min, max } = nicknameLength;

    const nickname = $('#inviteFriendInput').val();
    const validateNickname = this.validateName(nickname, min, max*3);

    if(validateNickname){
      socket.emit('create:invite', nickname);
      return;
    }
    this.addNotice('RegularNotice', {text: `${textInfo['0.6']} от ${min} до ${max*3} символов.`}, ttl.regularInvitation);
  }
};
