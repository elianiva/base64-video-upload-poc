import { useEffect, useRef, useState } from "react";
import axios from "axios";
import "./App.css";

function blobToBase64(blob: Blob): Promise<string> {
	return new Promise((res, rej) => {
		const reader = new FileReader();
		reader.readAsDataURL(blob);
		reader.onloadend = () => {
			if (typeof reader.result !== "string") {
				rej("result was not a string");
				return;
			}

			res(reader.result);
		};
		reader.onerror = (err) => {
			rej(reader.error);
		};
	});
}

function App() {
	const videoElement = useRef<HTMLVideoElement | null>(null);
	const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
	const mediaRecorder = useRef<MediaRecorder | null>(null);
	const [isStreaming, setStreaming] = useState(false);
	const [videoSources, setVideoSources] = useState<InputDeviceInfo[]>([]);
	const [isAllowed, setAllowed] = useState(false);
	const [isSubmitting, setSubmitting] = useState(false);
	const [uploadProgress, setUploadProgress] = useState("");

	async function getUserMedia(deviceId?: string): Promise<MediaStream> {
		return new Promise(async (res, rej) => {
			try {
				const userMedia = await navigator.mediaDevices.getUserMedia({
					audio: false,
					video: {
						deviceId: deviceId ? { exact: deviceId } : undefined,
						width: 640,
						height: 360,
					},
				});
				res(userMedia);
			} catch (err) {
				console.log({ err });
				rej(err);
			}
		});
	}

	async function acquirePermission() {
		console.log("Checking permission...");
		// this is using the old way of checking permission since firefox doesn't support permissions API for camera
		try {
			const stream = await getUserMedia();
			setVideoStream(stream);
			setAllowed(true);
		} catch (err: unknown) {
			setAllowed(false);
			alert("Please allow camera permission and refresh the page.");
		}
	}

	async function startStreamHandler() {
		try {
			if (videoStream === null) {
				await acquirePermission();
				return;
			}

			mediaRecorder.current = new MediaRecorder(videoStream, {
				mimeType: "video/webm;codecs=h264",
				videoBitsPerSecond: 1_000_000, // 0.5Mbits / sec
			});
			mediaRecorder.current.start();
			mediaRecorder.current.onstart = () => console.log("Start recording...");
			mediaRecorder.current.ondataavailable = async (e: BlobEvent) => {
				const base64 = await blobToBase64(e.data);
				// strip mimetype
				const videoStream = base64.split(",").at(1);
				console.log({ base64, videoStream });
				try {
					setSubmitting(true);
					await axios.post(
						"http://localhost:3000/video",
						{ videoStream },
						{ onUploadProgress: (event) => setUploadProgress(event.bytes.toString()) }
					);
					alert("Video has been succesfully sent");
				} catch (err) {
					const message = err instanceof Error ? err.message : "Unknown Error";
					console.error({ message });
				} finally {
					setSubmitting(false);
				}
			};

			setStreaming(true);

			if (videoElement.current === null) {
				return;
			}

			videoElement.current.srcObject = videoStream;
		} catch (err) {
			if (err instanceof Error) {
				if (err.message === "Permission denied") {
					alert("Please allow camera access");
				}

				console.error(err.message);
			}
		}
	}

	function stopStreamHandler() {
		if (videoElement.current === null || videoStream === null || mediaRecorder.current === null) {
			return;
		}

		const videoTracks = videoStream.getVideoTracks();
		videoTracks[0].stop();

		mediaRecorder.current.stop();
		videoElement.current.srcObject = null;
		setStreaming(false);
	}

	async function changeVideoSource(deviceId: string) {
		const newStream = await getUserMedia(deviceId);
		setVideoStream(newStream);
	}

	useEffect(() => {
		(async () => {
			const sources = await navigator.mediaDevices.enumerateDevices();
			setVideoSources(
				sources.filter(
					(source): source is InputDeviceInfo =>
						source instanceof InputDeviceInfo && source.kind === "videoinput"
				)
			);
		})();
	}, [isAllowed]);

	return (
		<div className="App">
			{isSubmitting ? (
				<div className="loading-box">
					<span>Submitting...</span>
					<span>{uploadProgress}</span>
				</div>
			) : (
				<>
					<video className="video" ref={videoElement} controls autoPlay width={640} height={360}></video>
					<div className="buttons">
						{isAllowed ? (
							<>
								{isStreaming ? (
									<button className="button stop" onClick={stopStreamHandler}>
										Stop Stream
									</button>
								) : (
									<button className="button start" onClick={startStreamHandler}>
										Start Stream
									</button>
								)}
								<select
									className="source-selection"
									placeholder="Select Source"
									onChange={(e) => changeVideoSource(e.currentTarget.value)}
								>
									{videoSources.map((source) => (
										<option key={source.groupId} value={source.deviceId}>
											{source.label}
										</option>
									))}
								</select>
							</>
						) : (
							<button className="button start" onClick={acquirePermission}>
								Allow Permission
							</button>
						)}
					</div>
				</>
			)}
		</div>
	);
}

export default App;
