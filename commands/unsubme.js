const Discord = require('discord.js')
const channelTracker = require('../util/channelTracker.js')
const getSubList = require('./util/getSubList.js')
const currentGuilds = require('../util/guildStorage.js').currentGuilds

module.exports = function(bot, message, command) {
  const guildRss = currentGuilds.get(message.guild.id)
  const rssList = (guildRss && guildRss.sources) ? guildRss.sources : {}
  const botRole = message.guild.members.get(bot.user.id).highestRole
  const memberRoles = message.member.roles

  // Get an array of eligible roles that is lower than the bot's role, and is not @everyone by filtering it
  const filteredMemberRoles = memberRoles.filterArray(function(role) {
    return (role.comparePositionTo(botRole) < 0 && role.name !== '@everyone')
  })

  const eligibleRoles = []
  for (var a in filteredMemberRoles) eligibleRoles.push(filteredMemberRoles[a].name);

  if (filteredMemberRoles.length === 0) return message.channel.sendMessage('There are no eligible roles to be removed from you.').catch(err => console.log(`Promise Warning: subRem 1: ${err}`));

  const list = new Discord.RichEmbed()
    .setTitle('Self-Subscription Removal')
    .setDescription('Below is the list of feeds, their channels, and its eligible roles that you may remove yourself from. Type the role name you want removed, or type *exit* to cancel.\n_____')
  // Generate a list of feeds and eligible roles to be removed

  const options = getSubList(bot, message.guild, rssList)
  for (var option in options) {
    let roleList = '';
    for (var memberRole in filteredMemberRoles) {
      if (options[option].roleList.includes(filteredMemberRoles[memberRole].id)) {
        roleList += filteredMemberRoles[memberRole].name + '\n';
        filteredMemberRoles.splice(memberRole, 1);
      }
    }
    if (roleList) {
      let channelID = options[option].source.channel;
      let channelName = message.guild.channels.get(channelID).name;
      list.addField(options[option].source.title, `**Channel:**: #${channelName}\n${roleList}`, true);
    }
  }

  // Some roles may not have a feed assigned since it prints all roles below the bot's role.
  if (filteredMemberRoles.length > 0) {
    let leftoverRoles = '';
    for (var leftoverRole in filteredMemberRoles) {
      leftoverRoles += filteredMemberRoles[leftoverRole].name + '\n';
    }
    list.addField(`No Feed Assigned`, leftoverRoles, true);
  }

  message.channel.sendEmbed(list)
  .then(function(list) {
    const collectorFilter = m => m.author.id == message.author.id
    const collector = message.channel.createCollector(collectorFilter,{time:240000})
    channelTracker.addCollector(message.channel.id)
    collector.on('message', function(response) {
      // Select a role here
      const chosenRoleName = response.content
      if (chosenRoleName.toLowerCase() === 'exit') return collector.stop('Self-subscription removal canceled.');
      const chosenRole = message.guild.roles.find('name', chosenRoleName)

      function isValidRole() {
        if (eligibleRoles.includes(chosenRoleName)) return true;
      }

      if (!chosenRole || !isValidRole()) return message.channel.sendMessage('That is not a valid role to remove. Try again.').catch(err => console.log(`Promise Warning: subRem 2: ${err}`));

      collector.stop()
      message.member.removeRole(chosenRole)
      .then(function(member) {
        console.log(`Self subscription: (${message.guild.id}, ${message.guild.name}) => Removed *${chosenRole.name}* from member.`)
        message.channel.sendMessage(`You no longer have the role **${chosenRole.name}**.`).catch(err => console.log(`Promise Warning: subRem 3: ${err}`))
      })
      .catch(function(err) {
        console.log(`Self Subscription: (${message.guild.id}, ${message.guild.name}) => Could not remove role *${chosenRole.name}*, ` + err)
        message.channel.sendMessage(`An error occured - could not remove your role *${chosenRole.name}*`).catch(err => console.log(`Promise Warning: subRem 4: ${err}`))
      })

    })
    collector.on('end', function(collected, reason) {
      channelTracker.removeCollector(message.channel.id)
      if (reason === 'time') return message.channel.sendMessage(`I have closed the menu due to inactivity.`).catch(err => {});
      else if (reason !== 'user') return message.channel.sendMessage(reason);
    })
  }).catch(err => console.log(`Commands Warning: (${message.guild.id}, ${message.guild.name}) => Could not send self subscription removal prompt. (${err})`))
}
