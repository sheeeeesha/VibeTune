# FolderActivityLogger
[Dr. James Gopsill](http://jamesgopsill.github.io)

This is a lightweight [node.js]() command line tool used to track the metadata activity within a folder and it's sub-folders using [chokidar](https://www.npmjs.com/package/chokidar). The raw information is then stored using [neDB](https://www.npmjs.com/package/nedb), which we can then access, post-process and analyse further.

The tool was built as part of the EPSRC [Language of Collaborative Manufacturing](http://locm.blogs.ilrt.org) project and used to collect data on the digital activity of a Formula Student project. The aim was to see if the metadata activity could provide insights into the performance of the project and final product. This could then be used to support Engineering Project Management in real-time.

We want to encourage more Engineering Design researchers to capture and analyse the digital activity of engineering projects as we see it having great potential in providing insights for both practitioners and researchers.

# Installation

The first thing you need to do to get up and running is to have node installed on your system. Node.js installers can be found [here](https://nodejs.org/en/download/). To confirm that you have node installed and running on your system, you can open a terminal/command prompt window and run the following command:

```

$ node -v

```

This should display the version of node that you're running on your system.

Now that you have node installed, you can use the built-in node package manager [npm](https://www.npmjs.com) to install the FolderActivityLogger onto your system. Again, in the terminal/command prompt run the following command.

```

$ npm install -g fal

```

This will install the FolderActivityLogger in your global node environment and enable you to call it anywhere on your system.

# Usage

Now, create a folder where you wish to store the data that you want to collect. In that folder, create a config.json file, which will contain the configuration details for fal.

**config.json**

```

{
  "folder": "<folder-path-here>",
  "db": "./meta-log.nde.db",
  "logFromStart": true,
  "chokidarOptions" : {
    "userPolling" : true,
    "alwaysStat" : true,
    "ignorePermissionErrors" : true
  }
}

```

- `folder` the path to the folder you wish to monitor
- `db` this is the path to the db (will be automatically created if it does not already exist).
- `initialScan` (default: true) will capture all the current information of the folder structure on start
- `chokidarOptions` parse options to chokidar for it to work correctly in your environment. Use the defaults above if unsure.

`cd` into the folder and run the following command to start fal.

```

$ fal

```

You will need to keep the terminal window open for it to continue to capture changes to the meta-data. We are developing the tool further so that you can start it as a background service on your computer/server.

# Output

** meta-log.nedb **

The output is stored in the nedb format, which is a NoSQL document store. The events that are captured are: add/addDir, change, unlink/unlinkDir.

The add, addDir and change events will contain the following information. This comes from node.js [fs.stat](https://nodejs.org/api/fs.html#fs_stat_time_values) function.

- `event`: event type that was captured (add, addDir, change)
- `path`: path to the object (file/folder/symbolic link)
- `dev`: device number that the object is held on
- `mode`: information on the type of object and permissions of the object
- `nlink`: hard links
- `uid`: user-id of the owner of the object
- `gid`: group-id of the owner of the object
- `rdev`: device Id (if special file)
- `blksize`: block size for filesystem I/O
- `ino`: inode number
- `size`: size in bytes
- `blocks`: number of blocks allocated
- `atimeMs`: time when file data was last accessed (milliseconds)
- `mtimeMs`: time when file data was last modified (milliseconds)
- `ctimeMs`: vtime when file status was last changed (milliseconds)
- `birthtimeMs`: time of file creation (only available on some systems, milliseconds)
- `atime`: time when file data was last accessed
- `mtime`: time when file data was last modified
- `ctime`: time when file status was last changed
- `birthtime`: time of file creation (only available on some systems)
- `_id`: unique database document id
- `createdAt`: date of creation of the document
- `updatedAt`: most recent update to the document

Whilst unlink/unlinkDir contain the date when the file/folder was removed from the folder.

- `event`: event type that was captured (unlink, unlinkDir)
- `path`: file/folder path of interest
- `_id`: unique database document id
- `createdAt`: date of creation of the document
- `updatedAt`: most recent update to the document

# Citation

Please feel free to download and use this within your research projects. All we ask is that you cite our work in your paper and that you add your paper to the growing list of work that has used the tool in their studies! :)

Gopsill, J., Snider, C., McMahon, C., & Hicks, B. (2016). Automatic generation of design structure matrices through the evolution of product models. *Artificial Intelligence for Engineering Design, Analysis and Manufacturing*, 30(4), 424-445. doi:10.1017/S0890060416000391

```latex

@article{gopsill2016,
  title={Automatic generation of design structure matrices through the evolution of product models},
  volume={30},
  DOI={10.1017/S0890060416000391},
  number={4},
  journal={Artificial Intelligence for Engineering Design, Analysis and Manufacturing},
  publisher={Cambridge University Press},
  author={Gopsill, James A. and Snider, Chris and McMahon, Chris and Hicks, Ben},
  year={2016},
  pages={424–445},
  url={https://jamesgopsill.github.io/Publications/papers/journal/aiedam2016/aiedam2016.pdf}
}

```

Also, we would love to hear how you're using the tool and the studies that you're performing with it.

# Roadmap

1. Run as a background service on your computer/server
2. Publish the post-processing tools to automatically create Design Structure Matrices from the metadata captured in the neDB format.
3. Provide methods to anonymise the data for publication
4. Provide a service to store and share metadata logs of engineering projects

# List of Publications

This is a list of papers that have used the tool in their studies.


[Gopsill, J.A., Snider, C.M., Emanuel, L., Joel-Edgar, S., & Hicks, B.J. (2017). Automatic design structure matrices: a comparison of two formula student projects. In: *Proceedings of the 21st International Conference on Engineering Design (ICED17), Vol. 6: Design Information and Knowledge, Vancouver, Canada.*](https://jamesgopsill.github.io/Publications/papers/conference/iced2017/iced2017.pdf)

[Gopsill, J.A., Snider, C.M., McMahon, C., & Hicks, B.J. (2016). Automatic generation of design structure matrices through the evolution of product models. *Artificial Intelligence for Engineering Design, Analysis and Manufacturing*, 30(4), 424-445. doi:10.1017/S0890060416000391](https://jamesgopsill.github.io/Publications/papers/journal/aiedam2016/aiedam2016.pdf)

[Gopsill, J.A., Snider, C.M., Shi L., and Hicks B.J. (2015). Modelling the evolution of computer aided design models: investigating the potential for supporting engineering project management. In: *Proceedings of the International Conference on Product Lifecycle Management (PLM15)*.](https://jamesgopsill.github.io/Publications/papers/conference/plm2015/plm2015.pdf)

[Gopsill, J.A., Shi, L. McMahon, C. & Hicks B.J. (2014). The engineering design process through an understanding of the evolution of engineering digital objects. In: *Proceedings of the International Conference on DESIGN*.](https://jamesgopsill.github.io/Publications/papers/conference/design2014/design2014b.pdf)
