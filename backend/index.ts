import fastify from "fastify";
import cors from "@fastify/cors";
import * as fs from "fs/promises";

const app = fastify({ logger: true });

type VideoStreamUploadRequest = {
	videoStream: string; // base64
};

app.register(cors, {
	origin: "*",
});

app.post("/video", async (req, reply) => {
	const { videoStream } = req.body as VideoStreamUploadRequest;
	if (videoStream === undefined) throw new Error("videoStream can't be empty");

	try {
		await fs.writeFile(`uploaded/video_${Date.now()}.mp4`, videoStream, { encoding: "base64" });
		reply.code(200).send({ message: "Ok" });
	} catch (err) {
		reply.code(400).send({ message: "Invalid video payload" });
	}
});

try {
	await app.listen({ port: 3000 });
} catch (err) {
	app.log.error(err);
	process.exit(1);
}
