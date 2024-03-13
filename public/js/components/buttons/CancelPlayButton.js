class CancelPlayButton extends Component('#menuPlayButtonSection'){
  constructor(){
    super();

    this.handlers = {
      click: {
        '#cancelPlayButton': e => this.cancelPlayButton(e),
      },
    }
  }
  init(){
    const { textInfo } = this.getState().config;
    this.remove('StartGameControl');
    $('#menuMiddleSection').html(textInfo['0']);
  }
  uninit(){
    const { player, room, config } = this.getState();
    if(room && room.leader != player.id) {
      $('#menuMiddleSection').html('');
      $(this.element).html(config.textInfo['7']);
    }else{
      this.add('StartGameControl');
      this.add('PlayButton');
    }
  }
  cancelPlayButton(e){
    e.preventDefault();
    this.getState().socket.emit('game:search:cancel');
  }
};
