var App, from_b64, from_hex, from_utf8, to_b64, to_hex, to_utf8;

App = {
  Models: {},
  Collections: {},
  Views: {}
};

to_b64 = function(bin) {
  return sjcl.codec.base64.fromBits(bin).replace(/\//g, '_').replace(/\+/g, '-');
};

from_b64 = function(b64) {
  return sjcl.codec.base64.toBits(b64.replace(/\_/g, '/').replace(/\-/g, '+'));
};

to_hex = sjcl.codec.hex.fromBits;

from_hex = sjcl.codec.hex.toBits;

to_utf8 = sjcl.codec.utf8String.fromBits;

from_utf8 = sjcl.codec.utf8String.toBits;

App.S = {
  cipher: sjcl.cipher.aes,
  mode: sjcl.mode.ccm,
  curve: sjcl.ecc.curves.c384,
  x00: sjcl.codec.hex.toBits("0x00000000000000000000000000000000"),
  x01: sjcl.codec.hex.toBits("0x00000000000000000000000000000001"),
  x02: sjcl.codec.hex.toBits("0x00000000000000000000000000000002"),
  x03: sjcl.codec.hex.toBits("0x00000000000000000000000000000003"),
  encrypt: function(key, data, iv) {
    var cipher;
    cipher = new App.S.cipher(key);
    return App.S.mode.encrypt(cipher, data, iv);
  },
  decrypt: function(key, data, iv) {
    var cipher;
    cipher = new App.S.cipher(key);
    return App.S.mode.decrypt(cipher, data, iv);
  },
  hide: function(key, data) {
    var iv;
    iv = sjcl.random.randomWords(4);
    return to_b64(sjcl.bitArray.concat(iv, App.S.encrypt(key, data, iv)));
  },
  bare: function(key, data) {
    var hidden_data, iv;
    data = from_b64(data);
    iv = sjcl.bitArray.bitSlice(data, 0, 128);
    hidden_data = sjcl.bitArray.bitSlice(data, 128);
    return App.S.decrypt(key, hidden_data, iv);
  },
  hide_text: function(key, text) {
    return App.S.hide(key, from_utf8(text));
  },
  bare_text: function(key, data) {
    return to_utf8(App.S.bare(key, data));
  },
  hide_seckey: function(key, seckey) {
    return App.S.hide(key, seckey.toBits());
  },
  bare_seckey: function(key, data) {
    return sjcl.bn.fromBits(App.S.bare(key, data));
  }
};

var FileHasher;

FileHasher = function(file, callback) {
  var BLOCKSIZE, hash_slice, i, j, reader, sha;
  BLOCKSIZE = 2048;
  i = 0;
  j = Math.min(BLOCKSIZE, file.size);
  reader = new FileReader();
  sha = new sjcl.hash.sha256();
  hash_slice = function(i, j) {
    return reader.readAsArrayBuffer(file.slice(i, j));
  };
  reader.onloadend = function(e) {
    var array, bitArray;
    array = new Uint8Array(this.result);
    bitArray = sjcl.codec.bytes.toBits(array);
    sha.update(bitArray);
    if (i !== file.size) {
      i = j;
      j = Math.min(i + BLOCKSIZE, file.size);
      return setTimeout((function() {
        return hash_slice(i, j);
      }), 0);
    } else {
      return callback(sha.finalize());
    }
  };
  return hash_slice(i, j);
};

var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

App.Views.home = (function(_super) {
  __extends(home, _super);

  function home() {
    this.render = __bind(this.render, this);
    return home.__super__.constructor.apply(this, arguments);
  }

  home.prototype.render = function() {
    this.$el.html($("#homeViewTemplate").html());
    App.Views.UserList = new App.Views.userList({
      el: $("#userList")
    });
    App.Views.UserList.render();
    App.Views.MessageList = new App.Views.messageList({
      el: $("#messageList"),
      collection: App.Collections.Messages
    });
    App.Views.MessageList.render();
    App.Views.PageList = new App.Views.pageList({
      el: $("#pageList"),
      collection: App.Collections.Pages
    });
    App.Views.PageList.render();
    return this;
  };

  return home;

})(Backbone.View);

var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

App.Views.log = (function(_super) {
  __extends(log, _super);

  function log() {
    this.signin = __bind(this.signin, this);
    this.signup = __bind(this.signup, this);
    this.load_user = __bind(this.load_user, this);
    this.hash_file = __bind(this.hash_file, this);
    this.render = __bind(this.render, this);
    return log.__super__.constructor.apply(this, arguments);
  }

  log.prototype.render = function() {
    this.$el.html($("#logViewTemplate").html());
    return this;
  };

  log.prototype.events = {
    'change #file_password_input': 'hash_file',
    'click #signin': 'signin',
    'click #signup': 'signup'
  };

  log.prototype.hash_file = function(e) {
    var file, template;
    template = $("#StartHashFileTemplate").html();
    this.$("#file_password_input").replaceWith(_.template(template));
    file = e.target.files[0];
    return FileHasher(file, function(result) {
      template = $("#EndHashFileTemplate").html();
      this.$(".progress").replaceWith(_.template(template));
      this.$(".progress").addClass("progress-bar-success");
      return $('#file_password_result_input').val(result);
    });
  };

  log.prototype.load_user = function() {
    var password, sha;
    App.I = new App.Models.User({
      pseudo: $('#pseudo_input').val(),
      string_password: $('#string_password_input').val(),
      file_password: $('#file_password_result_input').val()
    });
    sha = new sjcl.hash.sha256();
    sha.update(App.I.get('file_password'));
    sha.update(App.I.get('string_password'));
    password = sha.finalize();
    App.I.set({
      password: password
    }).auth();
    App.I.on('error', (function(_this) {
      return function() {
        return alert("Login error...");
      };
    })(this));
    return App.I.on('sync', (function(_this) {
      return function() {
        return App.Router.show("home");
      };
    })(this));
  };

  log.prototype.signup = function() {
    this.load_user();
    App.I.create_ecdh().create_mainkey().hide_ecdh().hide_mainkey();
    App.I.isNew = function() {
      return true;
    };
    return App.I.save();
  };

  log.prototype.signin = function() {
    this.load_user();
    App.I.isNew = function() {
      return false;
    };
    return App.I.save();
  };

  return log;

})(Backbone.View);

var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

App.Views.messageList = (function(_super) {
  __extends(messageList, _super);

  function messageList() {
    this.render = __bind(this.render, this);
    return messageList.__super__.constructor.apply(this, arguments);
  }

  messageList.prototype.render = function() {
    var destination, message, messages, template, user, _i, _len;
    this.collection.sort();
    messages = this.collection.toJSON();
    for (_i = 0, _len = messages.length; _i < _len; _i++) {
      message = messages[_i];
      user = App.Collections.Users.findWhere({
        id: message.user_id
      });
      destination = message.destination_type === "user" ? App.Collections.Users.findWhere({
        id: message.destination_id
      }) : App.Collections.Pages.findWhere({
        id: message.destination_id
      });
      message.source = user.attributes;
      message.destination = destination.attributes;
      message.createdAt = (new Date(message.createdAt)).toLocaleString();
    }
    template = Handlebars.compile($("#messageListTemplate").html());
    this.$el.html(template({
      messages: messages
    }));
    return this;
  };

  return messageList;

})(Backbone.View);

var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

App.Views.pageList = (function(_super) {
  __extends(pageList, _super);

  function pageList() {
    this.search_page = __bind(this.search_page, this);
    this.render = __bind(this.render, this);
    return pageList.__super__.constructor.apply(this, arguments);
  }

  pageList.prototype.render = function() {
    var template;
    template = Handlebars.compile($("#pageListTemplate").html());
    this.$el.html(template({
      pages: App.Collections.Pages.toJSON()
    }));
    return this;
  };

  pageList.prototype.events = {
    'keypress #create_page_input': 'search_page'
  };

  pageList.prototype.search_page = function(e) {
    var name, page;
    if (e.which === 13) {
      name = $("#create_page_input").val();
      page = new App.Models.Page({
        name: name
      });
      page.save();
      page.on('error', (function(_this) {
        return function() {
          return alert("Can't save...");
        };
      })(this));
      return page.on('sync', (function(_this) {
        return function() {
          $("#create_page_input").val("");
          App.Collections.Pages.add(page);
          return _this.render();
        };
      })(this));
    }
  };

  return pageList;

})(Backbone.View);

var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

App.Views.pageTalk = (function(_super) {
  __extends(pageTalk, _super);

  function pageTalk() {
    this.go_home = __bind(this.go_home, this);
    this.talk = __bind(this.talk, this);
    this.render = __bind(this.render, this);
    this.page_users = __bind(this.page_users, this);
    this.selected_messages = __bind(this.selected_messages, this);
    return pageTalk.__super__.constructor.apply(this, arguments);
  }

  pageTalk.prototype.selected_messages = function() {
    var messages;
    messages = new App.Collections.messages();
    messages.push(App.Collections.Messages.where({
      destination_type: 'page',
      destination_id: this.model.get('id')
    }));
    return messages;
  };

  pageTalk.prototype.page_users = function() {
    return App.Collections.Users.toJSON();
  };

  pageTalk.prototype.render = function() {
    var template;
    template = Handlebars.compile($("#pageTalkTemplate").html());
    this.$el.html(template({
      page: this.model.attributes
    }));
    $("textarea").autosize();
    App.Views.MessageList = new App.Views.messageList({
      el: $("#messageList"),
      collection: this.selected_messages()
    });
    App.Views.MessageList.render();
    App.Views.PageUserList = new App.Views.pageUserList({
      el: $("#pageUserList"),
      collection: this.page_users()
    });
    return App.Views.PageUserList.render();
  };

  pageTalk.prototype.events = {
    'click #send_message': 'talk',
    'click #back_button': 'go_home'
  };

  pageTalk.prototype.talk = function() {
    var hidden_content, message;
    hidden_content = $("#message_input").val();
    message = new App.Models.Message({
      destination_type: "page",
      destination_id: this.model.get('id'),
      hidden_content: hidden_content
    });
    message.on('error', (function(_this) {
      return function() {
        return alert("Sending error");
      };
    })(this));
    message.on('sync', (function(_this) {
      return function() {
        console.log("sync");
        console.log(message);
        App.Collections.Messages.add(message);
        App.Views.MessageList.collection.push(message);
        App.Views.MessageList.render();
        return $("#message_input").val("");
      };
    })(this));
    return message.save();
  };

  pageTalk.prototype.go_home = function() {
    return App.Router.show("home");
  };

  return pageTalk;

})(Backbone.View);

var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

App.Views.pageUserList = (function(_super) {
  __extends(pageUserList, _super);

  function pageUserList() {
    this.render = __bind(this.render, this);
    return pageUserList.__super__.constructor.apply(this, arguments);
  }

  pageUserList.prototype.render = function() {
    var template;
    template = Handlebars.compile($("#pageUserListTemplate").html());
    this.$el.html(template({
      users: this.collection
    }));
    return this;
  };

  return pageUserList;

})(Backbone.View);

var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

App.Views.userList = (function(_super) {
  __extends(userList, _super);

  function userList() {
    this.search_user = __bind(this.search_user, this);
    this.render = __bind(this.render, this);
    return userList.__super__.constructor.apply(this, arguments);
  }

  userList.prototype.render = function() {
    var template;
    template = Handlebars.compile($("#userListTemplate").html());
    this.$el.html(template({
      users: App.Collections.Users.toJSON()
    }));
    return this;
  };

  userList.prototype.events = {
    'keypress #search_user_input': 'search_user'
  };

  userList.prototype.search_user = function(e) {
    var pseudo, user;
    if (e.which === 13) {
      pseudo = $("#search_user_input").val();
      user = new App.Models.User({
        pseudo: pseudo
      });
      user.fetch();
      user.on('error', (function(_this) {
        return function() {
          return alert("Not found...");
        };
      })(this));
      return user.on('sync', (function(_this) {
        return function() {
          $("#search_user_input").val("");
          App.Collections.Users.add(user);
          return _this.render();
        };
      })(this));
    }
  };

  return userList;

})(Backbone.View);

var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

App.Views.userTalk = (function(_super) {
  __extends(userTalk, _super);

  function userTalk() {
    this.go_home = __bind(this.go_home, this);
    this.talk = __bind(this.talk, this);
    this.render = __bind(this.render, this);
    this.selected_messages = __bind(this.selected_messages, this);
    return userTalk.__super__.constructor.apply(this, arguments);
  }

  userTalk.prototype.selected_messages = function() {
    var messages;
    messages = new App.Collections.messages();
    messages.push(App.Collections.Messages.where({
      destination_type: 'user',
      user_id: App.I.get('id'),
      destination_id: this.model.get('id')
    }));
    messages.push(App.Collections.Messages.where({
      destination_type: 'user',
      user_id: this.model.get('id'),
      destination_id: App.I.get('id')
    }));
    return messages;
  };

  userTalk.prototype.render = function() {
    var template;
    template = Handlebars.compile($("#userTalkTemplate").html());
    this.$el.html(template({
      user: this.model.attributes
    }));
    $("textarea").autosize();
    App.Views.MessageList = new App.Views.messageList({
      el: $("#messageList"),
      collection: this.selected_messages()
    });
    return App.Views.MessageList.render();
  };

  userTalk.prototype.events = {
    'click #send_message': 'talk',
    'click #back_button': 'go_home'
  };

  userTalk.prototype.talk = function() {
    var hidden_content, message;
    hidden_content = $("#message_input").val();
    message = new App.Models.Message({
      destination_type: "user",
      destination_id: this.model.get('id'),
      hidden_content: hidden_content
    });
    message.on('error', (function(_this) {
      return function() {
        return alert("Sending error");
      };
    })(this));
    message.on('sync', (function(_this) {
      return function() {
        App.Collections.Messages.add(message);
        App.Views.MessageList.collection.push(message);
        App.Views.MessageList.render();
        return $("#message_input").val("");
      };
    })(this));
    return message.save();
  };

  userTalk.prototype.go_home = function() {
    return App.Router.show("home");
  };

  return userTalk;

})(Backbone.View);

var __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

App.Models.Message = (function(_super) {
  __extends(Message, _super);

  function Message() {
    return Message.__super__.constructor.apply(this, arguments);
  }

  Message.prototype.urlRoot = "/message";

  return Message;

})(Backbone.Model);

var __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

App.Models.Page = (function(_super) {
  __extends(Page, _super);

  function Page() {
    return Page.__super__.constructor.apply(this, arguments);
  }

  Page.prototype.urlRoot = "/page";

  return Page;

})(Backbone.Model);

var __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

App.Models.PageUser = (function(_super) {
  __extends(PageUser, _super);

  function PageUser() {
    return PageUser.__super__.constructor.apply(this, arguments);
  }

  PageUser.prototype.urlRoot = "/pageUser";

  return PageUser;

})(Backbone.Model);

var __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

App.Models.User = (function(_super) {
  __extends(User, _super);

  function User() {
    return User.__super__.constructor.apply(this, arguments);
  }

  User.prototype.urlRoot = "/user";

  User.prototype.idAttribute = "pseudo";

  User.prototype.toJSON = function() {
    return this.pick("id", "pseudo", "pubkey", "remote_secret", "hidden_seckey", "hidden_mainkey");
  };

  User.prototype.auth = function() {
    var cipher, key;
    key = sjcl.misc.pbkdf2(this.get('password'), this.get('pseudo'));
    cipher = new sjcl.cipher.aes(key);
    this.set('local_secret', sjcl.bitArray.concat(cipher.encrypt(App.S.x00), cipher.encrypt(App.S.x01)));
    return this.set('remote_secret', to_b64(sjcl.bitArray.concat(cipher.encrypt(App.S.x02), cipher.encrypt(App.S.x03))));
  };

  User.prototype.create_ecdh = function() {
    this.set({
      seckey: sjcl.bn.random(App.S.curve.r, 6)
    });
    return this.set({
      pubkey: to_b64(App.S.curve.G.mult(this.get('seckey')).toBits())
    });
  };

  User.prototype.hide_ecdh = function() {
    return this.set({
      hidden_seckey: App.S.hide_seckey(this.get('local_secret'), this.get('seckey'))
    });
  };

  User.prototype.bare_ecdh = function() {
    return this.set({
      seckey: App.S.bare_seckey(this.get('local_secret'), this.get('hidden_seckey'))
    });
  };

  User.prototype.create_mainkey = function() {
    return this.set({
      mainkey: sjcl.random.randomWords(8)
    });
  };

  User.prototype.hide_mainkey = function() {
    return this.set({
      hidden_mainkey: App.S.hide(this.get('local_secret'), this.get('mainkey'))
    });
  };

  User.prototype.bare_mainkey = function() {
    return this.set({
      mainkey: App.S.bare(this.get('local_secret'), this.get('hidden_mainkey'))
    });
  };

  User.prototype.shared = function(user) {
    var point;
    point = App.S.curve.fromBits(from_b64(this.get('pubkey'))).mult(App.I.get('seckey'));
    return this.set({
      shared: sjcl.hash.sha256.hash(point.toBits())
    });
  };

  return User;

})(Backbone.Model);


/*
  keys: ->
    keys = App.M.Keys.filter((o)=> o.user_id == @get('id') || App.M.Keys.where(dest_id: @get('id')))

  constructor: ->
    super
    unless @isNew()
      @load()
    else
      @on 'sync', @load
    @

  load: =>
    @bare_ecdh() if not @has('seckey') and @has('hidden_seckey')
    @bare_mainkey() if not @has('mainkey') and @has('hidden_mainkey')
    @shared() if not @has('shared') and @has('pubkey')

  log: =>
    shared = if @has('shared') then to_b64(@get('shared')) else "(null)"
 */

var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

App.Collections.messages = (function(_super) {
  __extends(messages, _super);

  function messages() {
    this.comparator = __bind(this.comparator, this);
    return messages.__super__.constructor.apply(this, arguments);
  }

  messages.prototype.model = App.Models.Message;

  messages.prototype.url = '/messages';

  messages.prototype.comparator = function(a, b) {
    return (new Date(a.get('createdAt'))) < (new Date(b.get('createdAt')));
  };

  return messages;

})(Backbone.Collection);

App.Collections.Messages = new App.Collections.messages();

var __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

App.Collections.pageUsers = (function(_super) {
  __extends(pageUsers, _super);

  function pageUsers() {
    return pageUsers.__super__.constructor.apply(this, arguments);
  }

  pageUsers.prototype.model = App.Models.pageUser;

  pageUsers.prototype.url = '/pageUsers';

  return pageUsers;

})(Backbone.Collection);

App.Collections.PageUsers = new App.Collections.pageUsers();

var __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

App.Collections.pages = (function(_super) {
  __extends(pages, _super);

  function pages() {
    return pages.__super__.constructor.apply(this, arguments);
  }

  pages.prototype.model = App.Models.Page;

  pages.prototype.url = '/pages';

  return pages;

})(Backbone.Collection);

App.Collections.Pages = new App.Collections.pages();

var __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

App.Collections.users = (function(_super) {
  __extends(users, _super);

  function users() {
    return users.__super__.constructor.apply(this, arguments);
  }

  users.prototype.model = App.Models.User;

  users.prototype.url = '/users';

  return users;

})(Backbone.Collection);

App.Collections.Users = new App.Collections.users();

var Router,
  __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

Router = (function(_super) {
  __extends(Router, _super);

  function Router() {
    this.pageTalk = __bind(this.pageTalk, this);
    this.userTalk = __bind(this.userTalk, this);
    this.home = __bind(this.home, this);
    this.index = __bind(this.index, this);
    this.show = __bind(this.show, this);
    return Router.__super__.constructor.apply(this, arguments);
  }

  Router.prototype.routes = {
    '': 'index',
    'home': 'home',
    'user/:id': 'userTalk',
    'page/:id': 'pageTalk'
  };

  Router.prototype.show = function(route) {
    return this.navigate(route, {
      trigger: true,
      replace: true
    });
  };

  Router.prototype.fetched = false;

  Router.prototype.index = function() {
    App.Content = new App.Views.log({
      el: $("#content")
    });
    return App.Content.render();
  };

  Router.prototype.home = function() {
    if (!App.I) {
      return this.show("");
    }
    if (App.Content) {
      App.Content.undelegateEvents();
    }
    if (this.fetched) {
      App.Collections.Users.add(App.I);
      App.Content = new App.Views.home({
        el: $("#content")
      });
      return App.Content.render();
    } else {
      return App.Collections.Messages.fetch({
        success: (function(_this) {
          return function() {
            return App.Collections.Users.fetch({
              success: function() {
                return App.Collections.Pages.fetch({
                  success: function() {
                    _this.fetched = true;
                    App.Collections.Users.add(App.I);
                    App.Content = new App.Views.home({
                      el: $("#content")
                    });
                    return App.Content.render();
                  }
                });
              }
            });
          };
        })(this)
      });
    }
  };

  Router.prototype.userTalk = function(id) {
    var model;
    if (!App.I) {
      return this.show("");
    }
    if (App.Content) {
      App.Content.undelegateEvents();
    }
    model = App.Collections.Users.findWhere({
      id: id
    });
    if (model) {
      App.Content = new App.Views.userTalk({
        el: $("#content"),
        model: model
      });
      return App.Content.render();
    } else {
      console.log("user not found !");
      return this.show("home");
    }
  };

  Router.prototype.pageTalk = function(id) {
    var model;
    if (!App.I) {
      return this.show("");
    }
    if (App.Content) {
      App.Content.undelegateEvents();
    }
    model = App.Collections.Pages.findWhere({
      id: id
    });
    if (model) {
      App.Content = new App.Views.pageTalk({
        el: $("#content"),
        model: model
      });
      return App.Content.render();
    } else {
      console.log("page not found !");
      return this.show("home");
    }
  };

  return Router;

})(Backbone.Router);

App.Router = new Router;

$(function() {
  return Backbone.history.start();
});
