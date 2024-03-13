class App extends Component(){
  constructor(){
    super();

    const socket = io('/', {transports: ['websocket']});
    this.setState({socket});

    // Player Events ---

    socket.on('init:player', init=>this.initPlayer(init));

    socket.on('notice', code=>this.notice(code));
    socket.on('ban:notice', time=>this.banNotice(time));
    socket.on('disconnect:notice', code=>this.disconnectNotice(code));
    socket.on('forced:game:over:notice', time=>this.forcedGameOverNotice(time));

    socket.on('invite', invite=>this.invite(invite));
    socket.on('successful:invite', ()=>this.successfulInvite());

    socket.on('reload', ()=>location.reload());

    // Room Events ---

    socket.on('init:room', room=>this.initRoom(room));

    socket.on('room:player:join', player=>this.react('Room', 'playerJoin', player));

    socket.on('room:player:connect', id=>this.react('Room', 'playerConnect', id));
    socket.on('room:player:disconnect', id=>this.react('Room', 'playerDisconnect', id));

    socket.on('room:leave', ()=>this.react('Room', 'leave'));
    socket.on('room:player:leave', id=>this.react('Room', 'playerLeave', id));

    socket.on('room:change:leader', id=>this.react('Room', 'changeLeader', id));

    // Game Events ---

    socket.on('init:game', game=>this.initGame(game));
    socket.on('end:game', winnerId=>this.react('Game', 'endGame', winnerId));

    socket.on('step', step=>this.react('Game', 'step', step));

    socket.on('say:uno', ()=>this.addToWebSocketQueue(async queue => {await this.react('Game', 'sayUno'); queue.end()}));
    socket.on('didnt:say:uno', ()=>this.addToWebSocketQueue(async queue => {await this.react('Game', 'didntSayUno'); queue.end()}));

    socket.on('game:search:start', () => this.add('CancelPlayButton'));
    socket.on('game:search:cancel', () => this.remove('CancelPlayButton'));
  }

  initPlayer(init){
    if(init.game) this.hideHeader();
    this.setState(init);
    this.add('Home');
  }

  initRoom(room){
    this.setState({room});
    this.add('Room');
  }

  initGame(game){
    this.hideHeader();
    this.setState({game});
    this.add('Game', this.getState().player);
  }

  notice(code){
    const { textInfo, ttl } = this.getState().config;
    this.addNotice('RegularNotice', {text: textInfo[code]}, ttl.regularInvitation);
  }
  banNotice(time){
    const { textInfo, ttl } = this.getState().config;
    this.showPreloader();
    this.addNotice('RegularNotice', {text: textInfo['6']});
    this.setNoticeTimer(time, ttl.timeForBan, ()=>location.reload());
  }
  disconnectNotice(code){
    const { textInfo } = this.getState().config;
    this.showPreloader();
    this.addNotice('RegularNotice', {text: textInfo[code]});
    this.remove('Home');
  }
  forcedGameOverNotice(time){
    const { textInfo, ttl } = this.getState().config;
    this.showPreloader();
    this.addNotice('RegularNotice', {text: textInfo['3']});
    this.setNoticeTimer(time, ttl.crashGameEnd, ()=>this.addNotice('GameOverProposalNotice', {text: textInfo['4']}));
  }

  invite(invite){
    const { textInfo, ttl } = this.getState().config;
    this.addNotice('InviteNotice', {text: `${JSON.parse(invite).nickname} ${textInfo['0.0']}`}, ttl.specialInvitation);
  }
  successfulInvite(){
    const { textInfo, ttl } = this.getState().config;
    this.addNotice('RegularNotice', {text: textInfo['0.1']}, ttl.regularInvitation);
    $('#inviteFriendInput').val('');
  }

  showPreloader(){
    $('#noticeList').css('top', '5px');
    $('#preloader').fadeIn(400);
  }
  hideHeader(){
    $('#noticeList').css('top', '5px');
    $('header').css('display', 'none');
    $('main').css('height', '100%');
  }
  showHeader(){
    $('#noticeList').css('top', '65px');
    $('header').css('display', 'flex');
    $('main').css('height', 'calc(100% - 65px)');
  }
};
