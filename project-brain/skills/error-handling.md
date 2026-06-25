# AI Skill - Error Handling Patterns

This guide documents correct patterns for catch logic, error logging, and user notification guidelines.

---

## 1. Backend Try-Catch Pattern
API routes should wrap database operations inside try-catch. If an exception occurs, map the issue to standard JSON layouts.

```javascript
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Room.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Room document not found.' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
  }
});
```

---

## 2. Client API Error Processing
Mobile client and admin web must intercept failed responses and map them to helpful system alerts:

```javascript
try {
  const result = await scanQRCode(code);
  setResult(result);
} catch (err) {
  if (err.response?.status === 404) {
    setError("QR code not registered in system.");
  } else {
    setError("Connection error. Please try again.");
  }
}
```
Do not output raw error code text stacks directly to general users. Include clean UI messaging.
