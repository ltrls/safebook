casper.options.viewportSize = width: 1024, height: 768

getRandomInt = (max) ->
	Math.floor(Math.random() * (max + 1))

getRandomString = ->
  getRandomInt(9999999).toString()

user_name1 = getRandomString()
user_name2 = getRandomString()

casper.test.begin 'You can use it with someone else', 5, (test) ->

  casper.start 'http://0.0.0.0:8000/', ->
    @sendKeys "#pseudo_input", user_name1
    @sendKeys "#string_password_input", user_name1
    @click "#signup"

  casper.waitForUrl('#home').thenOpen 'http://0.0.0.0:8000/', ->
    @sendKeys "#pseudo_input", user_name2
    @sendKeys "#string_password_input", user_name2
    @click "#signup"

  casper.waitForUrl '#home', ->
    @sendKeys "#search_user_input", user_name1
    @sendKeys "#search_user_input", casper.page.event.key.Enter

  casper.wait 200, ->
    test.assertElementCount("#userList li a", 2)
    @clickLabel user_name1

  casper.waitForUrl /#user\/.*/, ->
    @sendKeys "#message_input", "Secret message"
    @click "#send_message"

  casper.wait 200, ->
    test.assertElementCount("#messageList > div", 1)

  casper.thenOpen('http://0.0.0.0:8000/').wait 200, ->
    @sendKeys "#pseudo_input", user_name1
    @sendKeys "#string_password_input", user_name1
    @click "#signin"

  casper.waitForUrl('#home').wait 200, ->
    test.assertElementCount("#userList li a", 2)
    @clickLabel user_name2

  casper.waitForUrl /#user\/.*/, ->
    test.assertElementCount("#messageList > div", 1)
    test.assertSelectorHasText("#messageList", "Secret message")

  casper.then(-> test.done()).run()
