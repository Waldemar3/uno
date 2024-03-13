const { modes, guest, regexp } = require("../../config/uno.config.js");

module.exports = class Default {
  constructor(options){
    this.cards = [];

    this.io = options.io;
    this.emitter = options.emitter;
    this.adapter = options.io.adapter;

    this.socket = options.socket;
    this.store = options.socket.request.store;

    this.user = options.socket.request.session.passport.user;

    this.modeConfig = modes[this.constructor.name];
  }

  async initGame({ game: { players: playerCards, lastCard, lastStep, lastUpdate, start, firstStep, direction }, gameId }){
    const { id, isGuest } = this.user;

    this.socket.join(gameId);

    let players = await this.store.getPlayers(playerCards.map(({id})=>id));

    playerCards.forEach(({id: cardsId, cards},i) => players[i].cards = id != cardsId ? cards.length : cards);

    return { players: this.renameGuests(players), lastCard, lastStep, lastUpdate, start, firstStep, direction };
  }

  async createGame(numberOfPlayers){
    const { numberOfPlayerCards } = this.modeConfig;
    const { id, isGuest } = this.user;

    const game = await this.store.gameSearch(id, Number(numberOfPlayers));

    if(game){
      const [ ids, gameId ] = game;

      let players = await this.store.getPlayers(ids);

      players = this.renameGuests(players);

      for(const [i, player] of players.entries()){
        players[i].cards = await this.getRandomCards(numberOfPlayerCards);
      }

      const lastUpdate = Date.now(),
            lastCard = (await this.getRandomCards(1))[0],
            lastStep = Math.floor(Math.random()*players.length);

      const gameObj = {lastCard, lastStep, lastUpdate, start: lastUpdate, previousStep: lastStep, firstStep: true, direction: true, mode: 0 };

      await this.store.saveGame({ ...gameObj, players, cards: this.cards }, gameId);

      this.emitter.to(players.map(({socketId})=>socketId)).socketsJoin(gameId);

      players.forEach(({id: ID, socketId}) => this.io.to(socketId).emit('init:game', { ...gameObj, players: players.map(player => ({...player, cards: ID != player.id ? numberOfPlayerCards : player.cards})) }));
      return this;
    }
    return false;
  }

  async step(step, gameObject){
    const { id } = this.user,
          { regular, special, events, cardWithoutColor, cardCodLength, maxNumberOfCardsInDeck } = this.modeConfig,
          isSpecialCard = special.cards.indexOf(step[1]) !== -1,
          isRegularCard = regular.cards.indexOf(step[1]) !== -1,
          colorExist = regular.colors.indexOf(step[0]) !== -1,
          isEvent = events.indexOf(step) !== -1 && step;

    let { game, gameId } = gameObject, { players, start, lastStep, previousStep, lastCard, firstStep, unoSaid } = game;

    if(typeof step !== 'string' || !(new RegExp(regexp.checkCard).test(step)) || (!isSpecialCard && !isRegularCard && !isEvent) || (!isEvent && !colorExist)) return;

    const [ card, cardIndex ] = step.split(':'), reworkedCard = isSpecialCard && !isEvent ? cardWithoutColor+card[1] : card;

    if(firstStep && reworkedCard !== lastCard) return;

    let cards = players[lastStep].cards;

    if(isEvent === 'tc' && cards.length >= maxNumberOfCardsInDeck) return;

    if(!isEvent && !firstStep){
      if(!(this.compareCards(lastCard, card) || isSpecialCard) || cards[cardIndex] !== reworkedCard){
        this.socket.emit('cancel:step');
        return;
      }

      cards.splice(cardIndex, 1);
    }

    game = await (!isEvent ? (this[card[1]] ?? this['r']) : this[card]).call(this, { ...game, lastCard: isEvent ? lastCard : card, lastUpdate: Date.now(), previousStep: lastStep, firstStep: false, unoSaid: false, didntSayUnoStep: !unoSaid && players[previousStep].cards.length === 1 && isEvent === 'du' ? previousStep : false });
    const gameSaved = await this.store.updateGame(id, gameId, { ...game, newCards:undefined, socketId:undefined });

    if(!gameSaved) {
      if(!isEvent) this.socket.emit('cancel:step');
      return;
    }

    const { newCards, socketId } = game;
    step = { ...game, id, newCards, isEvent, firstStep, players:undefined, cards:undefined };

    if(cards.length === 0){
      this.store.removeDependence(gameId, 'game');
      this.emitter.to(gameId).emit('end:game', id);
    }

    if(newCards){
      const except = socketId ?
            (()=> (this.emitter.to(socketId).emit('step', step), socketId))() :
            (()=> (this.socket.emit('step', step), this.socket.id))();

      this.emitter.to(gameId).except(except).emit('step', { ...step, newCards: newCards.length });
    }else{
      this.emitter.to(gameId).emit('step', step);
    }

    const player = game.players[game.lastStep], except = [this.socket.id];

    if(player.cards.length === 2 && isEvent !== 'su'){
      const socketId = await this.store.getPlayerById(player.id, ['socketId']);
      this.emitter.to(socketId).emit('say:uno');
      except.push(socketId[0]);
    }
    if(!unoSaid && cards.length === 1 && isEvent !== 'du') this.emitter.to(gameId).except(except).emit('didnt:say:uno');
  }

  r(game){
    return { ...game, lastStep: this.nextStep(game, 1) };
  }
  s(game){
    return { ...game, lastStep: this.nextStep(game, 2) };
  }
  d(game){
    const { players, direction } = game;

    game.direction = !direction;

    return { ...game, lastStep: players.length < 3 ? this.nextStep(game, 2) : this.nextStep(game, 1) };
  }
  async t(game){
    const { players, cards } = game;

    this.cards = cards;

    const nextStep = this.nextStep(game, 1);
    const newCards = await this.getRandomCards(2);

    const socketId = await this.store.getPlayerById(players[nextStep].id, ['socketId']);

    players[nextStep].cards.push(...newCards);
    return { ...game, cards: this.cards, lastStep: this.nextStep(game, 2), newCards, socketId };
  }
  async f(game){
    const { players, cards, lastCard } = game;

    const nextStep = this.nextStep(game, 1);

    this.cards = cards;

    if(players[nextStep].cards.filter(card => card[0] === lastCard[0]).length === 0){
      const socketId = await this.store.getPlayerById(players[nextStep].id, ['socketId']), newCards = await this.getRandomCards(4);

      players[nextStep].cards.push(...newCards);
      return { ...game, cards: this.cards, lastStep: this.nextStep(game, 2), newCards, socketId };
    }

    return { ...game, lastStep: nextStep };
  }

  async tc(game){
    const { players, cards, lastStep } = game;

    this.cards = cards;

    const newCards = await this.getRandomCards(1);

    players[lastStep].cards.push(newCards[0]);
    return { ...game, cards: this.cards, lastStep: this.nextStep(game, 1), newCards };
  }

  async du(game){
    const { players, cards, didntSayUnoStep } = game;

    if(didntSayUnoStep === false) return game;

    this.cards = cards;

    const socketId = await this.store.getPlayerById(players[didntSayUnoStep].id, ['socketId']), newCards = await this.getRandomCards(2);

    players[didntSayUnoStep].cards.push(...newCards);
    return { ...game, cards: this.cards, newCards, socketId };
  }
  su(game){
    return { ...game, unoSaid: true };
  }

  nextStep({ players, lastStep, direction }, add){
    return direction ? lastStep+1+add > players.length ? lastStep-players.length+add : lastStep+add : lastStep-add < 0 ? lastStep+players.length-add : lastStep-add;
  }

  async getRandomCards(numberOfCards){
    if(this.cards < numberOfCards) this.cards = await this.store.getGameCards(this.mode) || this.setGameCards();

    let cards = [];
    while(cards.length < numberOfCards){
      let randomCard = Math.floor(Math.random()*this.cards.length);
      cards.push(this.cards[randomCard]);
      this.cards.splice(randomCard, 1);
    }

    return cards;
  }
  setGameCards(){
    const { regular, special, cardWithoutColor } = this.modeConfig;

    let cards = [];

    regular.colors.forEach(color => {
      let cardsWithColor = regular.cards.map(card => color+card);
      for(let i = 0; i < regular.repeat; i++) cards.push(...cardsWithColor);
    });
    for(let i = 0; i < special.repeat; i++) cards.push(...special.cards.map(card=>cardWithoutColor+card));

    this.store.setGameCards(this.constructor.name, cards);

    return cards;
  }
  compareCards(fcard, scard){
    for(let i = 0; i <= fcard.length-1; i++) if(fcard[i] === scard[i]) {
      return true;
    }
    return false;
  }
  renameGuests(players){
    players.forEach((player, i) => {if(player.authorized === 'none') players[i].authorized = JSON.stringify(guest)});
    return players;
  }
}
