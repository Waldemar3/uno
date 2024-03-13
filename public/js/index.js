ComponentManager.state = {
  Templates,
  config,
};

ComponentManager.startComponent = App;
ComponentManager.components = {
  GameOverProposalNotice,
  RegularNotice,
  InviteNotice,

  Home,
  Room,
  StartGameControl,
  RegistrationMenu,
  MenuForRegistered,

  PlayButton,
  CancelPlayButton,

  Game,
};
ComponentManager.setComponentTree({
  GameOverProposalNotice,
  RegularNotice,
  InviteNotice,

  Home:{
    Room,
    StartGameControl,
    RegistrationMenu,
    MenuForRegistered,

    PlayButton,
    CancelPlayButton,
  },

  Game,
});
