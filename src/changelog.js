import fs from "fs";
import cp from "child_process";
import core from "@actions/core";
import path from "path";

const TAG_BLACKLIST = [
    'skip-ci',
    'skip ci',
    'ci skip',
    'no ci',
    'skip actions',
    'actions skip'
];

// Prepare regex based on version
function versionToRegex(version) {
    const pattern = '^[ \\t]*#*[ \\t]*v?[ \\t]*' + version.replaceAll('.', '\\.');
    return new RegExp(pattern, 'gm');
}

// If changelog already has information about target version changes, clean it up
function cleanupChangelogIfAlreadyHasTargetVersion(changelogContents, targetVersion) {
    // Define the regex pattern to match
    const regex = versionToRegex(targetVersion);

    // Split by the regex
    const changelogParts = changelogContents.split(regex);
    //console.log(changelogParts);
    if (changelogParts.length > 0) {
        // Is split successful, we need only first part
        changelogContents = changelogParts[0];
    }

    return changelogContents.trimEnd();
}

// Normalize changelog format to be markdown compatible
function normalizeChangelog(changelogContents) {
    // Normalize whitespaces around stars
    changelogContents = changelogContents.replaceAll(/^\s*\*\s*/gm, '* ');

    // Add absent stars
    changelogContents = changelogContents.replaceAll(/^[ \t]*(\w)/gm, '* $1');

    // Normalize headers
    changelogContents = changelogContents.replaceAll(/^[ \t]*#*[ \t]*v?[ \t]*(\d+)/gm, '## v$1');

    // Replace more than two linebreaks with one
    changelogContents = changelogContents.replaceAll(/\n\s*\n/g, "\n");

    // Adding line breaks around headers
    changelogContents = changelogContents.replaceAll(/^(##.*)$/gm, "\n$1\n");

    return changelogContents;
}

function getGitLog(gitPath, fromTag, toTag) {
    const command = "cd " + gitPath + " && git log --no-merges " + fromTag + ".." + toTag + " --pretty=format:'%B||%h||%an||EOR'";
    core.debug("Getting git log:");
    core.debug(command);
    const result = cp.spawnSync('sh', ['-c', command]);
    return result.stdout.toString();
}

// Normalizes output given by the git log
function normalizeGitLogRecords(gitLogContents) {
    let records = gitLogContents.split(/\|\|EOR\s?/g);
    records = records.map(record => normalizeGitLogRecord(record));

    let normalizedRecords = [];
    for (const record of records) {
        if (Array.isArray(record)) {
            normalizedRecords = normalizedRecords.concat(record);
        } else {
            normalizedRecords.push(record);
        }
    }

    core.debug('=====================================');
    core.debug('Git log after first step normalization:')
    core.debug(normalizedRecords);
    core.debug('=====================================');

    return normalizedRecords
        .filter(function (record) {
            if (!record.text.length) return false;

            const recordText = record.text.toLowerCase();
            core.debug(recordText);
            if (
                recordText.startsWith('* breaking')
                || recordText.startsWith('* depr')
                || recordText.startsWith('* fix')
                || recordText.startsWith('* new')
                || recordText.startsWith('* update')
            ) {
                core.debug("Record above accepted for changelog.");
                return true;
            }

            core.debug("Skipping record above.");

            return false;
        })
        .sort(function (a, b) {
            const order = ['breaking', 'depr', 'fix', 'new', 'update'];
            const aMatch = a.text.match(/^\*?\s*(new|update|fix|depr|breaking)/i);
            let aIndex = -1;
            if (aMatch) {
                aIndex = order.indexOf(aMatch[1].toLowerCase());
            }
            if (aIndex === -1) {
                aIndex = 100;
            }

            const bMatch = b.text.match(/^\*?\s*(new|update|fix|depr|breaking)/i);
            let bIndex = -1;
            if (bMatch) {
                bIndex = order.indexOf(bMatch[1].toLowerCase());
            }
            if (bIndex === -1) {
                bIndex = 100;
            }

            if (aIndex > bIndex) {
                return 1;
            } else if (aIndex < bIndex) {
                return -1;
            } else {
                return 0;
            }
        });
}

// Normalizes output given by the git log
function normalizeGitLog(gitLogContents) {
    return normalizeGitLogRecords(gitLogContents)
        .map(record => record.text)
        .join("\n")
}

/**
 * Reformats and restructures git log into a format where we can work with it.
 * No filtering at this stage.
 * @param gitLogRecord
 * @returns {{text: string, tags: string[]}|{text: string, tags: string[]}[]}
 */
function normalizeGitLogRecord(gitLogRecord) {
    const [message, hash, author] = gitLogRecord.split('||');
    const messageParts = message.replace(/^\s+|\s+$/g, '')
        .split(/((?<=[;.]) ?(?=[A-Z][a-z]+: ?.*)|\s^)/gm)
        .map(part => part.replace(/^\s+|\s+$/g, '').trim())
        .filter(part => part.length > 0);

    if (messageParts.length == 0) {
        return {text: '', tagText: '', tags: []};
    }

    return messageParts.map(
        function (messagePart) {
            if (messagePart.match(/(Co)?-?authored-by/i)) {
                return {text: '', tagText: '', tags: []};
            }

            const tags = getRecordTags(messagePart);
            const messageWithoutTags = removeRecordTags(messagePart);
            const normalizedMessage = messageWithoutTags
                .trim()
                .replace(/^\*|[\.;]$/g, '')
                .trim();

            return {
                text: '* '
                    + normalizedMessage
                    + ' (' + hash + ' by ' + author + ')',
                tagText: '* ' + normalizedMessage,
                tags: tags
            };
        }
    );
}

function getRecordTags(messagePart) {
    const matches = messagePart.matchAll(/\[([^\]]+)]/g);
    const tags = [];

    for (const match of matches) {
        const tag = match[1].trim();
        if (tag.length) {
            tags.push(tag);
        }
    }

    return tags;
}

function removeRecordTags(messagePart) {
    return messagePart
        .replaceAll(/\s*\[[^\]]+]\s*/g, ' ')
        .replaceAll(/\s+/g, ' ')
        .trim();
}

function isTagBlacklisted(tag) {
    return TAG_BLACKLIST.includes(tag.toLowerCase());
}

function sanitizeTagForFileName(tag) {
    return tag.replace(/[^a-z0-9._-]/gi, '-');
}

function appendChangeLog(gitPath, changelogContents, targetVersion, fromTag, toTag) {
    const gitLog = generateChangelog(gitPath, fromTag, toTag);
    changelogContents = changelogContents + "\n\n## v" + targetVersion + "\n\n";
    if (gitLog.length) {
        changelogContents = changelogContents + gitLog + "\n";
    }
    return changelogContents;
}

function appendRecordsToChangelog(changelogContents, targetVersion, records, useTagText = false) {
    changelogContents = changelogContents + "\n\n## v" + targetVersion + "\n\n";
    if (records.length) {
        changelogContents = changelogContents + records.map(function (record) {
            if (useTagText) {
                return record.tagText;
            }

            return record.text;
        }).join("\n") + "\n";
    }
    return changelogContents;
}

function readChangelog(gitPath, changelogPath) {
    const fullPath = gitPath + '/' + changelogPath;

    if (!fs.existsSync(fullPath)) {
        return '';
    }

    return fs.readFileSync(fullPath, 'utf8').toString();
}

function prepareChangelogContents(gitPath, changelogPath, targetVersion) {
    let changelogContents = readChangelog(gitPath, changelogPath);
    changelogContents = cleanupChangelogIfAlreadyHasTargetVersion(changelogContents, targetVersion);
    changelogContents = normalizeChangelog(changelogContents);

    return changelogContents;
}

function validateVersion(version) {
    return /^\d+\.\d+\.\d+$/.test(version);
}

// Retrieves changes from git log since the last tag and formats the list
export function generateChangelog(gitPath, fromTag, toTag) {
    let gitLog = getGitLog(gitPath, fromTag, toTag);
    core.debug('=====================================');
    core.debug('Git log:');
    core.debug(gitLog);
    core.debug('=====================================');

    if (gitLog.length) {
        gitLog = normalizeGitLog(gitLog);
        core.debug('=====================================');
        core.debug('Git log after normalization and filtering:')
        core.debug(gitLog);
        core.debug('=====================================');

        if (!gitLog.length) {
            gitLog = '*All the changes in this version are ' +
                'insignificant and are\nprobably limited to ' +
                'code quality or infrastructure.*'
        }
    }

    return gitLog;
}

// Updates changelog file with the changes retrieved from git log
export function updateChangelog(gitPath, changelogPath, targetVersion, fromTag, toTag, useTags = false) {
    const gitLog = getGitLog(gitPath, fromTag, toTag);

    updateChangelogFromGitLog(gitPath, changelogPath, targetVersion, gitLog, useTags);
}

export function updateChangelogFromGitLog(gitPath, changelogPath, targetVersion, gitLog, useTags = false) {
    if (!validateVersion(targetVersion)) {
        console.error('Target version ' + targetVersion + ' does not seem to be correct version.');
        process.exit(1);
    }

    let changelogContents = prepareChangelogContents(gitPath, changelogPath, targetVersion);

    if (!useTags) {
        const gitLogContents = normalizeGitLog(gitLog);

        changelogContents = changelogContents + "\n\n## v" + targetVersion + "\n\n";
        if (gitLogContents.length) {
            changelogContents = changelogContents + gitLogContents + "\n";
        }

        fs.writeFileSync(gitPath + '/' + changelogPath, changelogContents);
        return;
    }

    const records = normalizeGitLogRecords(gitLog);

    changelogContents = appendRecordsToChangelog(changelogContents, targetVersion, records);
    fs.writeFileSync(gitPath + '/' + changelogPath, changelogContents);

    const recordsByTag = {};

    for (const record of records) {
        for (const tag of record.tags) {
            if (isTagBlacklisted(tag)) {
                continue;
            }

            if (!recordsByTag[tag]) {
                recordsByTag[tag] = [];
            }

            recordsByTag[tag].push(record);
        }
    }

    for (const [tag, tagRecords] of Object.entries(recordsByTag)) {
        const tagChangelogPath = path.join(
            path.dirname(changelogPath),
            'CHANGELOG.' + sanitizeTagForFileName(tag) + '.md'
        );

        let tagChangelogContents = prepareChangelogContents(gitPath, tagChangelogPath, targetVersion);
        tagChangelogContents = appendRecordsToChangelog(tagChangelogContents, targetVersion, tagRecords, true);

        fs.writeFileSync(gitPath + '/' + tagChangelogPath, tagChangelogContents);
    }
}
