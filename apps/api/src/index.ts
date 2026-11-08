          status: "RINGING",
          operatorId: null,
        },
        data: {
          operatorId: req.user!.id,
          status: "CONNECTED",
          answeredAt: new Date(),
        },
      });

      if (result.count === 0) {
        const existingCall = await db.callSession.findUnique({
          where: { id: req.params.id },
          select: { id: true, status: true, operatorId: true },
        });

        if (!existingCall) {
          return res.status(404).json({ error: "call_not_found" });
        }

        return res.status(409).json({
          error: "call_already_answered_or_ended",
          message: "Another operator has answered this call or it has ended.",
        });
      }

      const call = await db.callSession.findUnique({
        where: { id: req.params.id },
      });

      if (!call) {
        return res.status(404).json({ error: "call_not_found" });
      }

      io.to(`user:${call.callerUserId}`).emit("call:answered", {
        callId: call.id,
        operatorId: req.user!.id,
      });

      io.to("operators").emit("call:answered", {
        callId: call.id,
        operatorId: req.user!.id,
      });

      await audit({
        actorId: req.user!.id,
        actorRole: req.user!.role,
        action: "emergency_call.answer",
        targetType: "CallSession",
        targetId: call.id,
        req,
      });

      res.json({ call });
    } catch (err) {
      next(err);
    }
  },
);
app.post("/api/emergency/calls/:id/end", requireAuth, async (req, res, next) => {
  try {
    const call = await db.callSession.findUnique({ where: { id: req.params.id } });
    if (!call || (call.callerUserId !== req.user!.id && call.operatorId !== req.user!.id)) return res.status(404).json({ error: "call_not_found" });
    await db.callSession.update({ where: { id: call.id }, data: { status: "ENDED", endedAt: new Date(), endReason: String(req.body.reason ?? "ended") } });
    io.to(`user:${call.callerUserId}`).emit("call:ended", { callId: call.id });
    io.to("operators").emit("call:ended", { callId: call.id });
    res.json({ ended: true });
  } catch (err) { next(err); }
});

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "not_found", message: "Endpoint not found." });
});

// ============================================================
// Signed evidence URLs (HMAC + expiry)
// ============================================================
function newSignedEvidenceUrl(evidenceId: string, ttlMs: number): string {
  const exp = Date.now() + ttlMs;
  const sig = createHmac("sha256", env.JWT_ACCESS_SECRET).update(`${evidenceId}:${exp}`).digest("hex");
  return `/api/evidence/${evidenceId}/stream?sig=${sig}&exp=${exp}`;
}

function verifyEvidenceSignature(evidenceId: string, sig: string, exp: number): boolean {
  if (Date.now() > exp) return false;
  const expected = createHmac("sha256", env.JWT_ACCESS_SECRET).update(`${evidenceId}:${exp}`).digest("hex");
  const a = Buffer.from(sig, "hex");
  const b = Buffer.from(expected, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ============================================================
// Start
// ============================================================
const PORT = env.PORT;
httpServer.listen(PORT, () => {
  console.log(`[REPORTA API] listening on :${PORT} (${env.NODE_ENV})`);
});

export default app;
