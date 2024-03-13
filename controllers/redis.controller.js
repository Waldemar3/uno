const { server, cookie } = require("../config/server.config.js").redis;

const express = require('express-session');
const Store = require('connect-redis')(express);

const RedisIO = require('ioredis');
const redis = new RedisIO(server);

const session = express({
  store: new Store({ client: redis }),
  secret: 'secret',
  resave: false,
  cookie: cookie,
  saveUninitialized: false,
});

redis.defineCommand("gameSearch", {
  numberOfKeys: 1,
  lua: `
    local getGameRoom
    getGameRoom = function(room, numberOfPlayers, originalRoom, zrem, queue, currentQueue)
      if numberOfPlayers <= #room or ARGV[5] == 'none' then
        for i, player in ipairs(room) do
          redis.call('hset', 'player:'..player, 'gameId', ARGV[2])
        end
        redis.call('setex', 'game:'..ARGV[2], ARGV[3], cjson.encode({ players = room, start = false, lastUpdate = ARGV[4] }))
        if #zrem ~= 0 then
          redis.call('zrem', 'queue', unpack(zrem))
        end

        return { room, ARGV[2] }
      elseif currentQueue == 0 then
        return getGameRoom(room, numberOfPlayers, originalRoom, {}, redis.call('zrevrangebyscore', 'queue', numberOfPlayers..numberOfPlayers - #room, numberOfPlayers..1, 'WITHSCORES'), 1)
      elseif queue[currentQueue] == nil then
        redis.call('zadd', 'queue', numberOfPlayers..#originalRoom[1], originalRoom[2])
        return false
      else
        local countCurrentQueue = tonumber(string.char(string.byte(queue[currentQueue+1], 2)))

        if #room + countCurrentQueue <= numberOfPlayers then
          if countCurrentQueue > 1 then
            local queueRoom = redis.call('get', 'room:'..queue[currentQueue])

            if queueRoom then
              queueRoom = cjson.decode(queueRoom)
              for i, player in ipairs(queueRoom.players) do
                table.insert(room, player)
              end
            end
          else
            table.insert(room, queue[currentQueue])
          end
          table.insert(zrem, queue[currentQueue])
        end

        return getGameRoom(room, numberOfPlayers, originalRoom, zrem, queue, currentQueue + 2)
      end
    end

    local createGameRoom = function(room, queueId)
      local numberOfPlayers = tonumber(ARGV[1])

      return getGameRoom(room, numberOfPlayers, {{unpack(room)}, queueId}, {}, {}, 0)
    end

    local gameId = redis.call('hget', 'player:'..KEYS[1], 'gameId')
    if gameId then return false end

    local roomId = redis.call('hget', 'player:'..KEYS[1], 'roomId')
    local room = roomId and redis.call('get', 'room:'..roomId) or false

    if room then
      local hasQueue = redis.call('zrank', 'queue', roomId)
      if hasQueue then return false end

      room = cjson.decode(room)

      if room.leader == KEYS[1] then
        return createGameRoom(room.players, roomId)
      end

      return false
    end

    local hasQueue = redis.call('zrank', 'queue', KEYS[1])
    if hasQueue then return false end

    return createGameRoom(KEYS, KEYS[1])
  `,
});

redis.defineCommand("updateGame", {
  numberOfKeys: 2,
  lua: `
    local game = redis.call('get', 'game:'..KEYS[2])

    if game then
      game = cjson.decode(game)

      local lastStep = game.lastStep+1
      local player = game.players[lastStep]
      local didntSayUnoStep = cjson.decode(ARGV[1]).didntSayUnoStep

      if player.id ~= KEYS[1] and type(didntSayUnoStep) ~= 'number' then return false end

      redis.call('set', 'game:'..KEYS[2], ARGV[1])

      return true
    end

    return false
  `,
});

redis.defineCommand("createInvitation", {
  numberOfKeys: 2,
  lua: `
    local invite = redis.call('get', 'invite:'..KEYS[1])
    if invite then return false end

    local hasQueue = redis.call('zrank', 'queue', KEYS[1])
    if hasQueue then return false end

    local gameId = redis.call('hget', 'player:'..KEYS[1], 'gameId')
    if gameId then return false end

    local roomId = redis.call('hget', 'player:'..KEYS[1], 'roomId')
    local room = roomId and redis.call('get', 'room:'..roomId) or false
    if room then return false end

    redis.call('setex', 'invite:'..KEYS[1], ARGV[1], KEYS[2])
    return redis.call('hget', 'player:'..KEYS[2], 'authorized')
  `,
});

redis.defineCommand("addPlayerToRoom", {
  numberOfKeys: 1,
  lua: `
    local inviter = redis.call('get', 'invite:'..KEYS[1])

    if inviter then
      redis.call('del', 'invite:'..KEYS[1])

      local invitedRoomId = redis.call('hget', 'player:'..KEYS[1], 'roomId')
      local invitedRoom = invitedRoomId and redis.call('get', 'room:'..KEYS[1]) or false
      if invitedRoom then return false end

      local invitedHasQueue = redis.call('zrank', 'queue', KEYS[1])
      if invitedHasQueue then return false end

      local invitedGameId = redis.call('hget', 'player:'..KEYS[1], 'gameId')
      if invitedGameId then return false end

      local hasQueue = redis.call('zrank', 'queue', inviter)
      if hasQueue then return false end

      local gameId = redis.call('hget', 'player:'..inviter, 'gameId')
      if gameId then return false end

      local roomId = redis.call('hget', 'player:'..inviter, 'roomId')
      local room = roomId and redis.call('get', 'room:'..roomId) or false

      local addToRoom = function(opt)
        redis.call('setex', 'room:'..opt[2], ARGV[2], opt[1])

        if opt[3] then
          redis.call('hset', 'player:'..opt[3], 'roomId', opt[2])
        end

        redis.call('hset', 'player:'..KEYS[1], 'roomId', opt[2])

        return opt
      end

      if room then
        local roomQueue = redis.call('zrank', 'queue', roomId)
        if roomQueue then return false end

        room = cjson.decode(room)

        if #room.players ~= 4 then
          table.insert(room.players, KEYS[1])
          return addToRoom({ cjson.encode(room), roomId, false })
        end
        return false
      end

      return addToRoom({ cjson.encode({ players = { inviter, KEYS[1] }, leader = inviter }), ARGV[1], inviter })
    end

    return false
  `,
});

redis.defineCommand("changeLeader", {
  numberOfKeys: 2,
  lua: `
    local gameId = redis.call('hget', 'player:'..KEYS[1], 'gameId')
    if gameId then return false end

    local roomId = redis.call('hget', 'player:'..KEYS[1], 'roomId')
    local room = roomId and redis.call('get', 'room:'..roomId) or false

    local hasQueue = redis.call('zrank', 'queue', roomId)
    if hasQueue then return false end

    local newLeaderNumber = KEYS[2]+1

    if room then
    room = cjson.decode(room)
    local newLeaderId = room.players[newLeaderNumber]

      if newLeaderId ~= nil and room.leader == KEYS[1] and newLeaderId ~= KEYS[1] then

        room.leader = newLeaderId
        redis.call('setex', 'room:'..roomId, ARGV[1], cjson.encode(room))

        return { roomId, newLeaderId }

      end

      return false
    end

    return false
  `,
});

redis.defineCommand("kick", {
  numberOfKeys: 2,
  lua: `
    local gameId = redis.call('hget', 'player:'..KEYS[1], 'gameId')
    if gameId then return false end

    local roomId = redis.call('hget', 'player:'..KEYS[1], 'roomId')
    local room = roomId and redis.call('get', 'room:'..roomId) or false

    local hasQueue = redis.call('zrank', 'queue', roomId)
    if hasQueue then return false end

    local kickNumber = KEYS[2]+1

    if room then
    room = cjson.decode(room)
    local kickId = room.players[kickNumber]

      if kickId ~= nil and room.leader == KEYS[1] and kickId ~= KEYS[1] then
        if #room.players ~= 2 then
          table.remove(room.players, kickNumber)
          redis.call('hdel', 'player:'..kickId, 'roomId')
          redis.call('setex', 'room:'..roomId, ARGV[1], cjson.encode(room))
        else
          redis.call('del', 'room:'..roomId)
        end

        return { roomId, kickId }

      end

      return false
    end

    return false
  `,
});

redis.defineCommand("leave", {
  numberOfKeys: 1,
  lua: `
    local gameId = redis.call('hget', 'player:'..KEYS[1], 'gameId')
    if gameId then return false end

    local roomId = redis.call('hget', 'player:'..KEYS[1], 'roomId')
    local room = roomId and redis.call('get', 'room:'..roomId) or false

    local hasQueue = redis.call('zrank', 'queue', roomId)
    if hasQueue then return false end

    if room then
    room = cjson.decode(room)
      if #room.players ~= 2 then

        for i, player in ipairs(room.players) do
          if player == KEYS[1] then
            table.remove(room.players, i)
            break
          end
        end

        if room.leader == KEYS[1] then
          room.leader = room.players[1]
        end
        redis.call('hdel', 'player:'..KEYS[1], 'roomId')
        redis.call('setex', 'room:'..roomId, ARGV[1], cjson.encode(room))
      else
        redis.call('del', 'room:'..roomId)
      end

      return roomId
    end

    return false
  `,
});

module.exports = { session, redis };
