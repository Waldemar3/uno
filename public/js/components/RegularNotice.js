class RegularNotice extends Component('#noticeList'){
  constructor(){
    super();

    this.handlers = {
      click: {
        delegate: [
          ['.noticeCloseButton', e => this.noticeCloseButton(e)],
        ],
      },
    }
  }
  noticeCloseButton(e){
    e.preventDefault();
    this.removeNotice(e);
  }
};
