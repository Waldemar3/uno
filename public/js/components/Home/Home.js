class Home extends Component('main'){
  constructor(){
    super();
  }
  init(){
    let { player, room, game, config } = this.getState(),
        { authorized } = player,
        { textInfo } = config;

    if(!game){
      if(authorized === 'none') {
        this.add('RegistrationMenu', {headerA: textInfo['8'], headerB: textInfo['9']});
      }else{
        this.add('MenuForRegistered', player);
      }

      this.add('PlayButton');
      this.add('StartGameControl');

      if(room) this.add('Room');
    }else{
      this.add('Game', player);
    }

    $('#preloader').fadeOut(400);
  }
};
