import React, { useState } from "react";
import { useSelector, useDispatch } from "react-redux";

import { calls } from "../../../../../core/calls";

import {
  setModal,
  setMission,
  setMissions,
  setSnackBarText,
} from "../../../../../core/ConfigureStore";

import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";

import CloseSharpIcon from "@mui/icons-material/CloseSharp";
import ShapeLineIcon from "@mui/icons-material/ShapeLine";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";

import TextField from "@mui/material/TextField";

import { makeStyles, useTheme } from "@mui/styles";
import useMediaQuery from "@mui/material/useMediaQuery";

const useStyles = makeStyles((theme) => ({
  Modal: {
    margin: theme.headHeights[1],
    [theme.breakpoints.down("xs")]: {
      margin: "6px",
    },
    "& .MuiDialog-container": {
      height: "unset !important",
      transform: "translateX(-50%) translateY(-50%)",
      left: "50%",
      top: "50%",
      position: "absolute",
    },
  },
  contents: {
    background: theme.palette.primary.main,
    height: "100%",
    width: "500px",
  },
  heading: {
    height: theme.headHeights[2],
    boxSizing: "border-box",
    background: theme.palette.swatches.p[4],
    borderBottom: `1px solid ${theme.palette.swatches.grey[800]}`,
    padding: `4px ${theme.spacing(2)} 4px ${theme.spacing(4)} !important`,
  },
  title: {
    padding: `8px 0px`,
    fontSize: theme.typography.pxToRem(16),
    fontWeight: "bold",
    color: theme.palette.swatches.grey[0],
    textTransform: "uppercase",
  },
  content: {
    padding: "8px 16px 16px 16px !important",
    height: `calc(100% - ${theme.headHeights[2]}px)`,
  },
  closeIcon: {
    padding: theme.spacing(1.5),
    height: "100%",
    margin: "4px 0px",
  },
  flexBetween: {
    display: "flex",
    justifyContent: "space-between",
  },
  subtitle: {
    fontSize: "14px !important",
    width: "100%",
    marginBottom: "8px !important",
    color: theme.palette.swatches.grey[300],
    letterSpacing: "0.2px",
  },
  subtitle2: {
    fontSize: "12px !important",
    fontStyle: "italic",
    width: "100%",
    marginBottom: "8px !important",
    color: theme.palette.swatches.grey[400],
  },
  confirmInput: {
    width: "100%",
    margin: "10px 0px 4px 0px !important",
    borderTop: `1px solid ${theme.palette.swatches.grey[500]}`,
  },
  backgroundIcon: {
    margin: "7px 8px 0px 0px",
  },

  fileName: {
    textAlign: "center",
    fontWeight: "bold",
    letterSpacing: "1px",
    marginBottom: "10px",
    borderBottom: `1px solid ${theme.palette.swatches.grey[500]}`,
    paddingBottom: "10px",
  },

  layerName: {
    textAlign: "center",
    fontSize: "24px !important",
    letterSpacing: "1px !important",
    color: theme.palette.swatches.p[4],
    fontWeight: "bold !important",
    margin: "10px !important",
    borderBottom: `1px solid ${theme.palette.swatches.grey[100]}`,
    paddingBottom: "10px",
  },
  hasOccurrencesTitle: {
    margin: "10px",
    display: "flex",
  },
  hasOccurrences: {
    fontStyle: "italic",
  },
  mission: {
    background: theme.palette.swatches.p[11],
    color: theme.palette.swatches.grey[900],
    height: "24px",
    lineHeight: "24px",
    padding: "0px 5px",
    borderRadius: "3px",
    display: "inline-block",
    letterSpacing: "1px",
    marginLeft: "20px",
  },
  pathName: {
    display: "flex",
    marginLeft: "40px",
    marginTop: "4px",
    height: "24px",
    lineHeight: "24px",
  },
  path: {
    color: theme.palette.swatches.grey[500],
  },
  name: {
    color: theme.palette.swatches.grey[100],
    fontWeight: "bold",
  },
  confirmMessage: {
    fontStyle: "italic",
    fontSize: "15px !important",
  },
  dialogActions: {
    display: "flex !important",
    justifyContent: "space-between !important",
  },
  delete: {
    background: `${theme.palette.swatches.p[4]} !important`,
    color: `${theme.palette.swatches.grey[1000]} !important`,
    "&:hover": {
      background: `${theme.palette.swatches.grey[0]} !important`,
    },
  },
  cancel: {},
}));

const MODAL_NAME = "deleteConfig";
const DeleteConfigModal = (props) => {
  const { queryGeoDatasets } = props;
  const c = useStyles();

  const modal = useSelector((state) => state.core.modal[MODAL_NAME]);
  const mission = useSelector((state) => state.core.mission);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const dispatch = useDispatch();

  const [missionName, setMissionName] = useState(null);

  const handleClose = () => {
    // close modal
    dispatch(setModal({ name: MODAL_NAME, on: false }));
  };
  const handleSubmit = () => {
    if (!mission) {
      dispatch(
        setSnackBarText({
          text: "Cannot delete undefined Mission.",
          severity: "error",
        })
      );
      return;
    }

    if (missionName !== mission) {
      dispatch(
        setSnackBarText({
          text: "Confirmation Mission name does not match.",
          severity: "error",
        })
      );
      return;
    }

    calls.api(
      "destroy",
      {
        mission: mission,
      },
      (res) => {
        dispatch(
          setSnackBarText({
            text: `Successfully deleted the '${mission}' Mission.`,
            severity: "success",
          })
        );
        dispatch(setMission(null));
        calls.api(
          "missions",
          null,
          (res) => {
            dispatch(setMissions(res.missions));
          },
          (res) => {
            dispatch(
              setSnackBarText({
                text: res?.message || "Failed to get available missions.",
                severity: "error",
              })
            );
          }
        );
        handleClose();
      },
      (res) => {
        dispatch(
          setSnackBarText({
            text: `Failed to delete the '${mission}' Mission.`,
            severity: "error",
          })
        );
      }
    );
  };

  return (
    <Dialog
      className={c.Modal}
      fullScreen={isMobile}
      open={modal !== false}
      onClose={handleClose}
      aria-labelledby="responsive-dialog-title"
      PaperProps={{
        className: c.contents,
      }}
    >
      <DialogTitle className={c.heading}>
        <div className={c.flexBetween}>
          <div className={c.flexBetween}>
            <ShapeLineIcon className={c.backgroundIcon} />
            <div className={c.title}>Delete a Mission</div>
          </div>
          <IconButton
            className={c.closeIcon}
            title="Close"
            aria-label="close"
            onClick={handleClose}
          >
            <CloseSharpIcon fontSize="inherit" />
          </IconButton>
        </div>
      </DialogTitle>
      <DialogContent className={c.content}>
        <Typography
          className={c.layerName}
        >{`Deleting: ${mission}`}</Typography>
        <TextField
          className={c.confirmInput}
          label="Confirm Mission Name"
          variant="filled"
          value={missionName}
          onChange={(e) => {
            setMissionName(e.target.value);
          }}
        />
        <Typography
          className={c.confirmMessage}
        >{`Enter '${mission}' above and click 'Delete' to confirm the permanent deletion of this Mission. None of the mission's data files in /Missions will be deleted.`}</Typography>
      </DialogContent>
      <DialogActions className={c.dialogActions}>
        <Button
          className={c.delete}
          variant="contained"
          startIcon={<DeleteForeverIcon size="small" />}
          onClick={handleSubmit}
        >
          Delete
        </Button>
        <Button className={c.cancel} variant="outlined" onClick={handleClose}>
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DeleteConfigModal;
