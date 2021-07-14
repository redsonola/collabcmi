// make a new file
//Brent Brimhall -- I think also some copying and pasting.

// returns promise that resolves to the created filename
export function makeFile(filename: string, body: string) {
    return fetch(`/api/write-recording?filename=${filename}`, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body
    });
}

// appends to a file, creates if it doesn't exist
// doesn't add a newline or anything
// returns promise that resolves to the created filename
export function appendFile(filename: string, body: string) {
    return fetch(`/api/append-recording?filename=${filename}`, {
        method: "POST",
        headers: { "Content-Type": "text/plain", },
        body
    });
}

// updates the list of files
// returns a promise that resolves to an array of file names
export function updateFileList() {
    return fetch(`/api/update-file-list`, { method: "POST" });
}

export type AppendFunction = (str: string) => Promise<any>;

/**
 * Create or replace a file called `fileName`.
 * Returns a function to append a line to the file.
 * The data is flushed to file at most every `time` ms -- it waits for the
 * last flush to finish before doing it again.
 * If no data is appended after `time`ms, it stops flushing until you append again.
 * If you try saving more than `maxBufferSize` characters and it doesn't successfully
 * flush, it will throw an error.
 * Nothing needs to be cleaned up when you stop using it.
 */
export function file(
    fileName: string,
    time = 1000,
    maxBufferSize = Math.pow(2, 8 * 3)
): AppendFunction {
    let contents: string[] = [];
    let lastFlush: Promise<any> = makeFile(fileName, '');
    let interval = 0;
    let linesSaved = 0;
    let pendingBufferSize = 0;

    function flush() {
        lastFlush = lastFlush.then(() => {
            if (contents.length === 0) {
                clearInterval(interval);
                interval = 0;
            } else {
                const data = contents.join('\n') + '\n';
                contents = [];
                pendingBufferSize = 0;
                return appendFile(fileName, data)
            }
        });
    }

    return function append(line: string) {
        if (process.env.NODE_ENV === "test")
            return Promise.reject("Don't save files in tests :(");

        if (pendingBufferSize > maxBufferSize) {
            const ex = new Error(`File ${fileName} full, ${pendingBufferSize} chars backed up`);
            return Promise.reject(ex);
        }
        pendingBufferSize += line.length;
        contents.push(line);
        linesSaved++;
        if (interval === 0) {
            interval = window.setInterval(flush, time);
        }
        return lastFlush.then(() => ({
            fileName,
            linesSaved,
            maxBufferSize,
            pendingBufferSize
        }));
    }
}

/**
 * Like `file` above, but takes a `getFileName` function. You can call the returned append function
 * at any time, but it won't do anything until `getFileName` returns a string -- at which point
 * the file will be named and calls to `append` will actually write a file.
 * `getFileName` also supplies it's own `append` function, which will be called first, so you can use that
 * to write a file header.
 * @param getFileName 
 * @param time 
 * @param maxBufferSize 
 */
export function deferredFile(
    getFileName: (appendHeaders: AppendFunction) => void | string,
    time = 1000,
    maxBufferSize = Math.pow(2, 8 * 3)
): AppendFunction {
    let fileAppender: AppendFunction | null = null;

    return async function append(line: string) {
        if (fileAppender) {
            return fileAppender(line);
        } else {
            let header: any = null;
            const name = getFileName(async (line) => { header = line });
            if (typeof name === 'string') {
                fileAppender = file(name, time, maxBufferSize);
                if (header !== null) fileAppender(header);
                return fileAppender(line);
            }
        }
    }
}
