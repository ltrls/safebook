class App.Views.pageLinkList extends Backbone.View

  initialize: =>
    @listenTo App.Collections.PageLinks, 'add', @render
    @listenTo App.Collections.PageLinks, 'remove', @render

  page_users: =>
    console.log @model
    page_users = []
    App.Collections.Users.each (user) =>
      tmp = _.clone(user.attributes)
      if @model.get('user_id') is user.get('id')
        tmp.creator = true
      if App.Collections.PageLinks.findWhere(
        page_id: @model.get('id')
        user_id: user.get('id')
      )
        tmp.auth = true
      page_users.push(tmp)
    page_users

  render: =>
    template = Handlebars.compile $("#pageLinkListTemplate").html()
    @$el.html template(users: @page_users())
    @

  events:
    'click .create': 'create'
    'click .delete': 'delete'

  create: (e) =>
    # Encipher the link key
    # XXX
    # Save the link
    App.Collections.PageLinks.create(
      page_id: @model.get('id')
      user_id: $(e.target).data('id')
    )
    false

  delete: (e) =>
    App.Collections.PageLinks.findWhere(
      page_id: @model.get('id')
      user_id: $(e.target).data('id')
    ).destroy()
    false
