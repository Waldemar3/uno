class StartGameControl extends Component('#menuMiddleSection'){
  constructor(){
    super();

    this.handlers = {
      click: {
        delegate: [
          ['.chooseNOPButton', e=>this.chooseNOPButton(e)],
        ],
      },
      change: {
        '#selectMode': e=>this.chooseMode(e),
      },
    }

    const { numberOfPlayers, defaultMode } = this.getState().config;
    this.setState({ numberOfPlayers, mode: defaultMode });
  }
  chooseMode(e){
    e.preventDefault();
    const val = e.target.value;
    $('#chooseMode i').attr('class', '').addClass(`mode-${val}`);
    this.setState({ mode: val });
  }
  chooseNOPButton(e){
    e.preventDefault();
    $('#chooseNOP').children().forEach(child => child.removeClass('active'));
    const button = $(e.target);
    button.addClass('active');
    this.setState({ numberOfPlayers: Number(button.index())+1 });
  }
};
