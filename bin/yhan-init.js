#!/usr/bin/env node

const program = require('commander')
const path = require('path')
const fs = require('fs')
const glob = require('glob') // npm i glob -D
const download = require('../lib/download')
const latestVersion = require('latest-version') 
const generator = require('../lib/generator')
const chalk = require('chalk') // command color
const logSymbols = require('log-symbols')

program
  .usage('<project-name>')
  .option('-r, --repository [repository]', 'assign to repository')
  .parse(process.argv)

// 根据输入，获取项目名称
let projectName = program.args[0]

if (!projectName) {  // project-name 必填
  // 相当于执行命令的--help选项，显示help信息，这是commander内置的一个命令选项
  program.help() 
  return
}

const list = glob.sync('*')  // 遍历当前目录
const inquirer = require('inquirer')

let rootName = path.basename(process.cwd())
let next = undefined
if (list.length) {  // 如果当前目录不为空
  if (list.filter(name => {
      const fileName = path.resolve(process.cwd(), path.join('.', name))
      // console.log(fileName)
      let isDir = fs.lstatSync(fileName).isDirectory()
      return name.indexOf(projectName) !== -1 && isDir
    }).length !== 0) {
    console.log(`项目${projectName}已经存在`)
    return
  }
  next = Promise.resolve(projectName)
} else if (rootName === projectName) {
    next = inquirer.prompt([
      {
        name: 'buildInCurrent',
        message: '当前目录为空，且目录名称和项目名称相同，是否直接在当前目录下创建新项目？',
        type: 'confirm',
        default: true
      }
    ]).then(answer => {
      return Promise.resolve(answer.buildInCurrent ? '.' : projectName)
    })
} else {
    next = Promise.resolve(projectName)
}

next && go()

function go () {
  next.then(projectRoot => {
    if (projectRoot !== '.') {
      fs.mkdirSync(projectRoot)
    }
    return download(projectRoot).then(target => {
      return {
        name: projectRoot,
        root: projectRoot,
        downloadTemp: target
      }
    })
  }).then(context => {
    return inquirer.prompt([
      {
        name: 'projectName',
    	  message: '项目的名称',
        default: context.name
      },
      {
        name: 'projectVersion',
        message: '项目的版本号',
        default: '1.0.0'
      },
      {
        name: 'projectDescription',
        message: '项目的简介',
        default: `A project named ${context.name}`
      }
    ]).then(answers => {
      // return latestVersion('node').then(version => {
      //   answers.supportUiVersion = version
        return {
          ...context,
          metadata: {
            ...answers
          }
        }
      // }).catch(err => {
      //   return Promise.reject(err)
      // })
    })
  })
  .then(context => {
    console.log(path.parse(context.downloadTemp).dir)
    return generator(context.metadata, context.downloadTemp, path.parse(context.downloadTemp).dir);
  })
  .then(res => {
    console.log(logSymbols.success, chalk.green('found success:)'))
    console.log(chalk.green('cd ' + res.dest + '\nnpm install\nnpm run dev'))
  })
  .catch(error => {
    console.error(logSymbols.error, chalk.red(`found faild：${error.message}`))
  })
}
