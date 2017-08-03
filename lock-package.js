#!/usr/bin/env node

const fs = require('fs-extra');
const chalk = require('chalk');
const exec = require('child_process').exec;
const ncu = require('npm-check-updates');
const program = require('commander');

const log = console.log;
const error = chalk.bold.red;
const success = chalk.bold.green;
const excludedDependencies = ['git', 'sassypam'];

program
    .version('0.1.0')
    .usage('[-u -f]')
    .option('-u, --update', 'Check for dependency updates.', checkNPMUpdates)
    .option('-f, --file', 'Package.json file path', lockPackageJSONDependencies)
    .parse(process.argv);

function lockPackageJSONDependencies() {
    getListDependencies()
        .then(loadPackageJSONFile)
        .then(writeToPackageJSONFile)
        .then(result => log(success(result)))
        .catch(err => log(error(err)))
}

/**
 * Get list of dependencies for package.json
 * 
 * @returns 
 */
function getListDependencies() {
    return new Promise((resolve, reject) => {
        exec('npm list --depth=0', (err, stdout, stderr) => {
            if (err) {
                reject(err)
                return;
            }

            const list = stdout.replace(/[├── └── ]/g, ',')
                .split(',')
                .filter(name => !!name.length)
                .slice(2)
                .filter(name =>
                    !excludedDependencies.some(dep => new RegExp(dep, 'g').test(name))
                )
                .map(name => name.replace(/\n/g, ''))
                .map(file => {
                    const [versionName, name, version] = file.match(/(.*[^.\d])(\d+[.\d]*)/i)

                    return Object.assign({}, { versionName, name: name.slice(0, -1), version })
                })
            resolve(list)
        });
    })
}

/**
 * Load package.json file
 * 
 * @param {{versionName:string, name:string, version:string}[]} list 
 * @return {Promise<{packageJSONFilePath:string, jsonFile:object}>}
 */
function loadPackageJSONFile(list) {
    return new Promise((resolve, reject) => {
        const packageJSONFilePath = process.argv[3] || 'package.json';
        fs.readJSON(packageJSONFilePath)
            .then(packageObj => {
                const { dependencies, devDependencies } = packageObj
                list.forEach(item => {
                    if (dependencies[item.name]) {
                        dependencies[item.name] = item.version
                    } else {
                        devDependencies[item.name] = item.version
                    }
                })

                resolve({ packageJSONFilePath, jsonFile: packageObj })
            })
            .catch(err => reject(err))
    })
}

/**
 * Write to package.json
 * 
 * @param {any} { packageJSONFilePath, jsonFile } 
 */
function writeToPackageJSONFile({ packageJSONFilePath, jsonFile }) {
    return new Promise((resolve, reject) => {
        fs.writeJSON(packageJSONFilePath, jsonFile, { spaces: 2 })
            .then(result => resolve('package.json file updated'))
            .catch(err => reject(err))
    })
}

function checkNPMUpdates() {
    ncu.run({
        // Always specify the path to the package file 
        packageFile: 'package.json',
        // Any command-line option can be specified here. 
        // These are set by default: 
        silent: true,
        jsonUpgraded: true
    }).then((upgraded) => {
        console.log('dependencies to upgrade:', upgraded);
    });
}