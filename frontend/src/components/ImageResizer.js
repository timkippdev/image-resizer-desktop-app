import React, { useState, useEffect, useRef } from "react";
import Button from "@material-ui/core/Button";
import { makeStyles } from "@material-ui/core/styles";
import wails from "@wailsapp/runtime";
import {
  TableContainer,
  Table,
  TableHead,
  TableBody,
  TableCell,
  TableRow,
} from "@material-ui/core";

const useStyles = makeStyles((theme) => ({
  button: {
    margin: theme.spacing(1),
    background: "#8e44ad",
  },
  root: {
    width: "100%",
  },
  container: {
    maxHeight: 400,
    minHeight: 400,
    backgroundColor: "#dedede",
  },
  table: {
    width: "100%",
    overflowY: "scroll",
  },
  tableCell: {
    fontSize: "0.92rem",
    padding: "4px 16px",
  },
}));

const columns = [
  { id: "path", label: "File Path" },
  { id: "status", label: "Status", align: "right" },
];

const ImageResizer = () => {
  const classes = useStyles();
  const [directory, setDirectory] = useState(null);
  const [files, setFiles] = useState([]);
  const [message, setMessage] = useState("Choose a directory to begin.");

  const [
    chooseDirectoryButtonDisabled,
    setChooseDirectoryButtonDisabled,
  ] = useState(false);
  const [
    triggerResizeButtonDisabled,
    setTriggerResizeButtonDisabled,
  ] = useState(true);

  const [currentProgressIndex, _setCurrentProgressIndex] = useState(0);
  const setCurrentProgressIndex = (data) => {
    currentProgressIndexRef.current = data;
    _setCurrentProgressIndex(data);
  };

  const currentProgressIndexRef = useRef(currentProgressIndex);

  const triggerChooseDirectory = () => {
    window.backend.Resizer.ChooseDirectory().then(
      console.log("directory change triggered")
    );
  }

  // TODO: Add max width/height to UI as input fields
  const maxWidth = 1000;
  const maxHeight = 1000;

  const triggerResizer = () => {
    if (directory && files.length > 0) {
      window.backend.Resizer.ResizeImages(
        directory,
        directory + "/__resized",
        maxWidth,
        maxHeight
      ).then(console.log("resizer triggered"));
    }
  };

  useEffect(() => {
    document.getElementById("resizeButton").disabled = true;

    wails.Events.On("GenericError", (result) => {
      console.log("GenericError event received:", result);
    });

    wails.Events.On("DirectoryChanged", (result) => {
      console.log("DirectoryChanged event received:", result);
      setDirectory(result.path);
      setFiles(result.files);
      setMessage("Ready to start resizing " + result.files.length + " images.");
      setTriggerResizeButtonDisabled(false);
    });

    wails.Events.On("ImageResizeStarted", (hash) => {
      console.log("ImageResizeStarted event received:", hash);
      document.getElementById(hash).style.backgroundColor = "#A9B7B4";
      document.getElementById("status-" + hash).innerText = "Pending";
    });

    wails.Events.On("ImageResizeSuccess", (hash) => {
      console.log("ImageResizeSuccess event received:", hash);
      document.getElementById(hash).style.backgroundColor = "#A0B8A5";
      document.getElementById("status-" + hash).innerText = "Complete";

      setCurrentProgressIndex(currentProgressIndexRef.current + 1);
    });

    wails.Events.On("ImageResizeFailed", (hash) => {
      console.log("ImageResizeFailed event received:", hash);
      document.getElementById(hash).style.backgroundColor = "#B8979A";
      document.getElementById("status-" + hash).innerText = "Failed";

      setCurrentProgressIndex(currentProgressIndexRef.current + 1);
    });

    wails.Events.On("ResizeBatchStarted", (result) => {
      console.log("ResizeBatchStarted event received:", result);
      document.getElementById("chooseDirectoryButton").disabled = true;
      document.getElementById("resizeButton").disabled = true;

      setMessage("Resizing In Progress...");
      setChooseDirectoryButtonDisabled(true);
      setTriggerResizeButtonDisabled(true);
    });

    wails.Events.On("ResizeBatchFinished", (result) => {
      console.log("ResizeBatchFinished event received:", result);
      document.getElementById("chooseDirectoryButton").disabled = false;
      document.getElementById("resizeButton").disabled = false;

      setMessage(
        'Resize Complete! Files were saved in directory named "__resized" inside the chosen directory.'
      );
      setChooseDirectoryButtonDisabled(false);
      setTriggerResizeButtonDisabled(false);
      setCurrentProgressIndex(0);
    });
  }, []);

  return (
    <div>
      <h2>Image Resizer</h2>
      <div id="resize-actions">
        <Button
          variant="contained"
          color="secondary"
          disabled={chooseDirectoryButtonDisabled}
          className={classes.button}
          id="chooseDirectoryButton"
          onClick={() => triggerChooseDirectory()}
        >
          Choose Directory
        </Button>

        <Button
          variant="contained"
          color="secondary"
          disabled={triggerResizeButtonDisabled}
          className={classes.button}
          id="resizeButton"
          onClick={() => triggerResizer()}
        >
          Start Resize
        </Button>
      </div>

      <p className="message">
        {message}
        {currentProgressIndex === 0
          ? ""
          : " (" + currentProgressIndex + " / " + files.length + ")"}
      </p>

      <div id="resize-table">
        <TableContainer className={classes.container}>
          <Table
            stickyHeader
            aria-label="sticky table"
            className={classes.table}
          >
            <TableHead>
              <TableRow>
                {columns.map((column) => (
                  <TableCell
                    key={column.id}
                    align={column.align}
                    style={{ minWidth: column.minWidth }}
                  >
                    {column.label}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {files.map((f) => {
                const simpleName = f.path.split("/").pop();
                return (
                  <TableRow hover tabIndex={-1} key={f.hash} id={f.hash}>
                    <TableCell
                      className={classes.tableCell}
                      key={"path-" + f.hash}
                    >
                      {simpleName}
                    </TableCell>
                    <TableCell
                      className={classes.tableCell}
                      align="right"
                      key={"status-" + f.hash}
                      id={"status-" + f.hash}
                    >
                      Queued
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </div>
    </div>
  );
};

export default ImageResizer;
