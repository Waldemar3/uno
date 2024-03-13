class PlayButton extends Component('#menuPlayButtonSection'){
  constructor(){
    super();

    this.handlers = {
      click: {
        '#playButton': e => this.playButton(e),
      },
    }
  }
  uninit(){
    const { player, room, config } = this.getState();
    if(room && room.leader != player.id) $(this.element).html(config.textInfo['7']);
  }
  playButton(e){
    e.preventDefault();
    const { numberOfPlayers, mode } = this.getState();
    this.getState().socket.emit('game:search:start', numberOfPlayers+':'+mode);
  }
};
