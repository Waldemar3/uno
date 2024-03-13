class InviteNotice extends Component('#noticeList'){
  constructor(){
    super();

    this.handlers = {
      click: {
        delegate: [
          ['.noticeButtonAccept', e => this.noticeButtonAccept(e)],
          ['.noticeButtonCancel', e => this.noticeButtonCancel(e)],
        ],
      },
    }
  }
  noticeButtonAccept(e){
    e.preventDefault();
    const { socket } = this.getState();
    socket.emit('accept:invite');
    this.removeNotice(e);
  }
  noticeButtonCancel(e){
    e.preventDefault();
    const { socket } = this.getState();
    socket.emit('cancel:invite');
    this.removeNotice(e);
  }
};
