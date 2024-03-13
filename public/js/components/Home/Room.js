class Room extends Component('#room'){
  constructor(){
    super();

    this.handlers = {
      click: {
        delegate: [
          ['.kickButton', e => this.kickButton(e)],
          ['.changeLeaderButton', e => this.changeLeaderButton(e)],
        ],
        '#leaveButton': e => this.leaveButton(e),
      },
    }
  }
  init(){
    const { player, room } = this.getState();

    $('#leaveButton').css('display', 'block');
    $(this.element).addClass('hide-control-panel').html('');

    if(room.leader != player.id){
      this.remove('StartGameControl');
      this.remove('PlayButton');
    }else{
      $(this.element).removeClass('hide-control-panel');
    }

    this.setMembers().forEach(member => this.addPlayer(member));
  }
  uninit(){
    $('#leaveButton').css('display', 'none');
    $(this.element).html(this.useTemplate('EmptyRoom'));
    this.add('StartGameControl');
    this.add('PlayButton');
  }

  playerJoin(player){
    const { room } = this.getState();
    room.players.push(player);
    this.setMembers();

    this.addPlayer(player);
  }
  playerConnect(id){
    this.getPlayerById(id).online = true;
    $(this.element).children()[this.getMemberIndex(id)].removeClass('disconnect');
  }
  playerDisconnect(id){
    this.getPlayerById(id).online = false;
    $(this.element).children()[this.getMemberIndex(id)].addClass('disconnect');
  }

  changeLeader(id){
    const { room } = this.getState();

    this.remove();
    this.setState({ room: {...room, leader: id} });
    this.add('Room');
  }

  playerLeave(id){
    const { room, config } = this.getState();
    const { ttl, textInfo } = config;
    const { players } = room;

    if(players.length <= 2){
      this.addNotice('RegularNotice', { text: textInfo['1.2']}, ttl.regularInvitation);
      this.leave();
      return;
    }

    $(this.element).children()[this.getMemberIndex(id)].remove();
    players.splice(this.getPlayerIndex(id), 1);
    this.setMembers();

    if(room.leader == id) this.changeLeader(players[0].id);
  }
  leave(){
    this.setState({ room: null });
    this.remove();
  }

  kickButton(e){
    e.preventDefault();
    this.getState().socket.emit('kick', this.getPlayerNumber(e.target));
  }
  changeLeaderButton(e){
    e.preventDefault();
    this.getState().socket.emit('change:leader', this.getPlayerNumber(e.target));
  }
  leaveButton(e){
    e.preventDefault();
    this.getState().socket.emit('leave');
  }

  addPlayer(player){
    const { room, config } = this.getState();
    let authorized = JSON.parse(player.authorized);

    const playerSlot = $('new', this.useTemplate('RoomSlot', { ...authorized, alt: config.guest.picture })).children()[0];
    if(room.leader == player.id) playerSlot.addClass('leader');
    if(!player.online) playerSlot.addClass('disconnect');

    $(this.element).append(playerSlot);
  }
  setMembers(){
    const { player, room } = this.getState();
    const { players } = room;

    const members = players.filter(p=> p.id != player.id);
    this.setState({room: {...room, members}});

    return members;
  }
  getMemberIndex(id){
    const { members } = this.getState().room;
    return members.findIndex(member => member.id == id);
  }
  getPlayerById(id){
    const { players } = this.getState().room;
    return players[players.findIndex(player => player.id == id)];
  }
  getPlayerIndex(id){
    const { players } = this.getState().room;
    return players.findIndex(player => player.id == id);
  }
  getPlayerNumber(element){
    const { players, members } = this.getState().room;
    return players.map(({id})=>id).indexOf(members[$(element.closest('.player')).index()].id);
  }
};
