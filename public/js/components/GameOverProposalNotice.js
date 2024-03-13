class GameOverProposalNotice extends Component('#noticeList'){
  constructor(){
    super();

    this.handlers = {
      click: {
        delegate: [
          ['.gameEndButton', e => this.gameEndButton(e)],
        ],
      },
    }
  }
  gameEndButton(e){
    e.preventDefault();
    this.getState().socket.emit('forced:game:over');
  }
};
