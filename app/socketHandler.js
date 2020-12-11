function ClientModel(group, id, type) {
  this.group = group;
  this.id = id;
  this.type = type;
}

module.exports = function(io) {

  var mSockets = [];
  var groups = new Map();
  var idMap = new Map();


  let clientType_Taurus = 'taurus';
  let clientType_Virgo = 'virgo';

  io.on('connection', function(client) {
    let socketId = client.id;

    console.log('-- socketId: ' + socketId + ' joined --');
    mSockets.push(client);
    client.emit('id', socketId);

    client.on('init', function (data) {
      handleInit(data);
  });

    client.on('search', function (data) {
        handleSearch(data);
    });

    client.on('message', function (data) {
        handleSignalingMessage(data);
    });

    function handleInit(data){
        let groupName = data.group;
        let clientType = data.clientType;
        let clientId = data.clientId;
        if (clientType !== clientType_Taurus && clientType !== clientType_Virgo) {
            return;
        }
        idMap.set(socketId, clientId);
        
        var group = groups.get(groupName);
        var taurusMap;
        var virgoMap;
        if (!group) {
            group = new Map();
            taurusMap = new Map();
            virgoMap = new Map();
            group.set(clientType_Taurus, taurusMap);
            group.set(clientType_Virgo, virgoMap);
            groups.set(groupName, group);
        }else{
          group = groups.get(groupName);
          taurusMap = group.get(clientType_Taurus);
          virgoMap = group.get(clientType_Virgo);
        }
        
        let clientModel = new ClientModel(groupName, clientId, clientType);
        // let clientModel = {'group':groupName, 'id': clientId, 'type': clientType};
        if (clientType == clientType_Taurus) {
            taurusMap.set(clientId, clientModel);
        }
        else if (clientType == clientType_Virgo) {
            virgoMap.set(clientId, clientModel);
        }


        console.log('-- socketid: ' + socketId + ' init ' + 'clientId: '+ clientId);
        // for (var i = 0; i < mSockets.length; i++) {
        //   var otherClient = mSockets[i];
        //   if (client.id != otherClient.id) {
        //     otherClient.emit('message',  {
        //         type: "init",
        //         from: client.id,
        //         clientType: clientType,
        //         group: group
        //     });
        //   }
        // }
    }
//  private tool method
    function getOtherClients(groupName, clientType){
      let group = groups.get(groupName);
      var otherClientMap;
      if (clientType == clientType_Taurus) {
        otherClientMap = group.get(clientType_Virgo);
      }
      else if (clientType == clientType_Virgo) {
        otherClientMap = group.get(clientType_Taurus);
      }
      return otherClientMap;
    }
    function getSelfClients(groupName, clientType) {
      let group = groups.get(groupName);
      var selfClientMap;
      if (clientType == clientType_Taurus) {
        selfClientMap = group.get(clientType_Virgo);
      }
      else if (clientType == clientType_Virgo) {
        selfClientMap = group.get(clientType_Taurus);
      }
      return selfClientMap;
    }
// webSocket 处理函数
    function handleSearch(data){
      let groupName = data.group;
      let clientId = data.clientId;
      let clientType = data.clientType;
      
      if (clientType !== clientType_Taurus) {
          return;
      }
      // 有新加进来的Virgo也需要告知， 暂时不处理
      // 返回当前已经在线的Virgo列表
      let otherMap = getOtherClients(groupName, clientType);
      var clients = [];
      for (const entry of otherMap) {
          let client = entry[1];
          clients.push(client);

      }
      let str = JSON.stringify(clients);
      console.log('-- search for clientId: ' + clientId +'  virgos: '+str);
      client.emit('searchResult', str);

      
    }

    function handleSignalingMessage(details){
      let groupName = details.group;
      let clientType = details.clientType;
      let clientId = details.from;
      let otherId = details.to;
      let type = details.type;

      // console.log('-- ' + client.id + ' message --' + JSON.stringify(details));
      console.log('-- clientId: ' + clientId + ' type: ' + type);

      var otherClientMap =  getOtherClients(groupName, clientType);           
      for (const key of otherClientMap.keys()) {
        if (key !== clientId) {
          let other = otherClientMap.get(key);
          sendMessageToOther(other.id, details);
        }
      }

      // var otherClient = io.sockets.connected[details.to];
      // if (!otherClient) {
      //   console.log(' ---' + client.id + 'message -- to' + details.to)
      //   return;
      // }
      // delete details.to;
      // otherClient.emit('message', details);
    }

    function sendMessageToOther(to, message) {
      let sc = io.sockets.connected[to];
      if (!sc) {
        console.log("错误 --- 未找到目标socket: " + to);
        return;
      }
      console.log("-- sendToOther: " + to);
      sc.emit("message", message);
    }

    
    
    
    

    function leave() {
      let clientId = idMap.get(socketId);

      console.log("-- socketId: " + socketId + " left --  clientId: " + clientId);
      var index = 0;
      while (index < mSockets.length && mSockets[index].id != client.id) {
        index++;
      }
      mSockets.splice(index, 1);

    
      for (const entry of groups) {
        let group = entry[1];
        let taurusMap = group.get(clientType_Taurus);
        let virgoMap = group.get(clientType_Virgo);
        if (taurusMap.has(clientId)) {
          taurusMap.delete(clientId);
        }
        if (virgoMap.has(clientId)) {
          virgoMap.delete(clientId);
        }
      }
      idMap.delete(socketId);
    }

    client.on('disconnect', leave);
    client.on('leave', leave);
  });
};