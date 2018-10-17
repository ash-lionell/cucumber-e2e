const path = require("path");
const gherkin = require("gherkin");
const glob = require("glob");
const fse = require("fs-extra");
const cuc_exp = require("cucumber-tag-expressions");

//const {Parser} = require("gherkin")
const Parser = gherkin.Parser;

//console.log("parser : ",parser);

global.appRoot = path.resolve(__dirname);

const args = process.argv;
//console.log(args);
const configPath = args[2];
const config = require(path.join(appRoot,configPath));
//console.log("config : ",config)

const runtime = (()=>{

    const readFile = function(filePath) {
        return new Promise((res,rej)=>{
            fse.readFile(filePath,"utf8",(err, contents)=>{
                if (err)
                    res(null);
                else
                    res(contents);
            });
        });
    }

    const parseFile = function(filePath, workflows) {
        return readFile(filePath).then(res=>{
            //console.log("res : ",res);
            if (res===null) {
                console.log("ERROR : No such file exists : ",filePath);
                return;
            }
            let parser = new Parser();
            let doc = parser.parse(res);
            //console.log("doc : ",doc)
            //console.log("sce : ",doc.feature)

            let featureTags = getTagNames(doc.feature.tags);
            doc.feature.children.forEach(scenario => {
                let scenarioTags = getTagNames(scenario.tags);
                //console.log("tags : ",featureTags,scenarioTags);

                let allTags = featureTags.concat(scenarioTags);

                checkAndAddScenario(scenario,workflows,allTags);
            })
        });
    }

    const getTagNames = function(tags) {
        let tagNames = [];
        tags.forEach(tag => tagNames.push(tag.name))
        return tagNames;
    }

    const checkAndAddScenario = function(scenario, workflows, allTags) {
        console.log("all tags : ",allTags);
        let tagParser = new cuc_exp.TagExpressionParser();
        workflows.forEach(workflow => {
            workflow.tags.forEach(tag => {
                let tagNode = tagParser.parse(tag);
                console.log("test : ",tag,allTags);
                if(tagNode.evaluate(allTags)) {
                    console.log("passed : ",tag);
                    let tagKey = workflow.tagKeys[tag];
                    if (tagKey===null || typeof tagKey==="undefined") {
                        workflow.tagKeys[tag] = [];
                        tagKey = workflow.tagKeys[tag];
                    }
                    tagKey.push(scenario);
                }
            })
        });
    }

    const reconstructTestCase = function(testCase) {
        console.log("reconstructing test case : ",testCase);

        let content = testCase.keyword+": "+testCase.name+"\n";
        content = getTagNames(testCase.tags).join(" ")+"\n"+content;
        testCase.steps.forEach(step => {
            let content2 = step.keyword.trim()+" "+step.text.trim();

            if (typeof step.argument!=="undefined") {
                console.log("argument : ",step.argument);
                step.argument.rows.forEach(row => {
                    content2 += "\n|"+getValuesFromCells(row.cells).join("|")+"|";
                })
            }

            content += content2+"\n";
        })

        let examples = testCase.examples;
        if (typeof examples!=="undefined") {
            examples = examples[0];
            let content3 = examples.keyword.trim()+":\n";
            console.log("examples : ",examples);
            //console.log("header : ",examples.tableHeader.cells);
            //console.log("body : ",examples.tableBody[0].cells);
            content3 += "|"+getValuesFromCells(examples.tableHeader.cells).join("|")+"|";
            examples.tableBody.forEach(body => {
                content3 += "\n|"+getValuesFromCells(body.cells).join("|")+"|";
            })

            content += content3;
        }

        return content;
    }

    const getValuesFromCells = function(cells) {
        let values = [];
        cells.forEach(cell => values.push(cell.value));
        return values;
    }

    const reconstructWorkflows = function(workflows,config) {
        workflows.forEach(workflow => {
            let tagKeys = workflow.tagKeys;
            workflow.isValid = true;
            workflow.invalidTags = [];
            if (Object.keys(tagKeys).length===0)
                workflow.isValid = false;
            else
                Object.keys(tagKeys).forEach(tagKey => {
                    let numOfMatchingScenarios = workflow.tagKeys[tagKey].length;
                    if (numOfMatchingScenarios!==1) {
                        workflow.invalidTags.push({
                            tagName : tag,
                            numOfMatchingScenarios : numOfMatchingScenarios
                        })
                        workflow.isValid = false;
                    }
                })

            //console.log("interim workflows : ",workflows);

            //if (workflow.invalidTags.length===0) {
            if (workflow.isValid) {
                workflow.children = [];
                workflow.tags.forEach(tag => {
                    workflow.children.push(tagKeys[tag][0])
                })
                //workflow.isValid = true;

                let featureTitle = "E2E - "+workflow.name;
                let contents = "Feature: "+featureTitle+"\n\n";

                //contents = workflow.tags.join(" ")+contents;

                workflow.children.forEach(child => {
                    contents += reconstructTestCase(child)+"\n\n";
                })

                contents = contents.trim();

                let outputDir = path.join(appRoot,config.outputDir);
                fse.ensureDir(outputDir)
                fse.writeFile(path.join(outputDir,featureTitle+".feature"),contents);
            }
            else {
                if (workflow.invalidTags.length>0)
                    console.log("e2e tag : [ "+workflow.name+" ] is invalid, following tags have problem : "+workflow.invalidTags);
                else
                    console.log("e2e tag : [ "+workflow.name+" ] is invalid, no scenarios match the given tags.");
                //workflow.isValid = false;
            }
        })
    }

    const getSrcSpecs = function(config) {
        var specs = config["srcSpecs"];
        if (specs===null || specs==="undefined") {
            throw new Error("No source features files were specified.");
        }
        if (typeof specs==="string")
            return [specs];
        else if (specs.constructor.name==="Array")
            return specs;
    }

    const expandSrcSpecsPaths = function(srcSpecs) {
        let expandedSrcSpecs = [];
        srcSpecs.forEach(spec => {
            console.log("processing file : ",spec);
            if (spec.endsWith(".feature")) {
                let tPath = path.join(appRoot,spec);
                if (!expandedSrcSpecs.includes(tPath))
                    expandedSrcSpecs.push(tPath)
            }
            else {
                let tempPaths = glob.sync(path.join(appRoot,spec)+"/**/*.feature");
                tempPaths.forEach(tempPath => {
                    tempPath = path.normalize(tempPath);
                    if (!expandedSrcSpecs.includes(tempPath))
                        expandedSrcSpecs.push(tempPath);
                })
            }
        })
        return expandedSrcSpecs;
    }

    return {
        runWith : function(config) {
            const srcSpecs = getSrcSpecs(config);
            const expandedSrcSpecs = expandSrcSpecsPaths(srcSpecs);
            console.log("expanded : ",expandedSrcSpecs);

            const e2eTags = config["e2eTags"];
            let workflows = [];
            Object.keys(e2eTags).forEach(key => {
                let workflow = {
                    name : key,
                    tags : e2eTags[key],
                    tagKeys : {}
                };
                workflows.push(workflow);
            })

            let parseProms = [];
            expandedSrcSpecs.forEach(expandedSrcSpec => {
                parseProms.push(parseFile(expandedSrcSpec,workflows));
            })

            Promise.all(parseProms).then(resps => {
                console.log("resps : ",resps);
                reconstructWorkflows(workflows,config);
            });
        }
    }
})();
runtime.runWith(config);


