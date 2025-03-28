import fs from "fs";
import cp from "child_process";

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

function getGitLog(fromTag, toTag) {
    const command = "git log --no-merges " + fromTag + ".." + toTag + " --pretty=format:'%B||%h||%an||EOR'";
    const result = cp.spawnSync('sh', ['-c', command]);
    return result.stdout.toString();
}

// Normalizes output given by the git log
function normalizeGitLog(gitLogContents) {
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

    return normalizedRecords
        .filter(function(record) {
            if (!record.length) return false;
            record = record.toLowerCase();
            if (
                record.startsWith('breaking')
                || record.startsWith('depr')
                || record.startsWith('fix')
                || record.startsWith('new')
                || record.startsWith('update')
            ) return false;

            return true;
        })
        .sort(function (a, b) {
            const order = ['breaking', 'depr', 'fix', 'new', 'update'];
            const aMatch = a.match(/^\*?\s*(new|update|fix|depr|breaking)/i);
            let aIndex = -1;
            if (aMatch) {
                aIndex = order.indexOf(aMatch[1].toLowerCase());
            }
            if (aIndex === -1) {
                aIndex = 100;
            }

            const bMatch = b.match(/^\*?\s*(new|update|fix|depr|breaking)/i);
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
        })
        .join("\n")
}

function normalizeGitLogRecord(gitLogRecord) {
    // First we split message into the parts we need
    const [message, hash, author] = gitLogRecord.split('||');
    // Then we trim line breaks and split commit message by line breaks.
    // We also try and split single-line messages describing several things.
    // Thanks to those who didn't care to format the messages a bit.
    const messageParts = message.replace(/^\s+|\s+$/g, '')
        .split(/((?<=[;.]) ?(?=[A-Z][a-z]+: ?.*)|\s^)/gm)
        .map(part => part.replace(/^\s+|\s+$/g, '').trim())
        .filter(part => part.length > 0);

    if (messageParts.length == 0) {
        return ''; // It will be filtered out
    }

    return messageParts.map(
        function (messagePart) {
            if (messagePart.match(/(Co)?-?authored-by/i)) {
                return '';
            } else {
                return '* '
                    + messagePart
                        .trim() // Remove spaces
                        .replace(/^\*|[\.;]$/g, '') // Remove stars and remove dots and semicolons
                        .trim() // and remove spaces again
                    + ' (' + hash + ' by ' + author + ')';
            }
        }
    );
}

function appendChangeLog(changelogContents, targetVersion, fromTag, toTag) {
    // TODO Improve this allowing to properly print changelog for every tag
    const gitLog = generateChangelog(fromTag, toTag);
    changelogContents = changelogContents + "\n\n## v" + targetVersion + "\n\n";
    if (gitLog.length) {
        changelogContents = changelogContents + gitLog + "\n";
    }
    return changelogContents;
}

function validateVersion(version) {
    return /^\d+\.\d+\.\d+$/.test(version);
}

// Retrieves changes from git log since the last tag and formats the list
export function generateChangelog(fromTag, toTag) {
    let gitLog = getGitLog(fromTag, toTag);
    if (gitLog.length) {
        gitLog = normalizeGitLog(gitLog);
    }
    return gitLog;
}

// Updates changelog file with the changes retrieved from git log
export function updateChangelog(changelogPath, targetVersion, fromTag, toTag) {
    if (!validateVersion(targetVersion)) {
        console.error('Target version ' + targetVersion + ' does not seem to be correct version.');
        process.exit(1);
    }

    let changelogContents = fs.readFileSync(changelogPath, 'utf8').toString();
    changelogContents = cleanupChangelogIfAlreadyHasTargetVersion(changelogContents, targetVersion);
    changelogContents = normalizeChangelog(changelogContents);
    changelogContents = appendChangeLog(changelogContents, targetVersion, fromTag, toTag);

    fs.writeFileSync(changelogPath, changelogContents);
}
