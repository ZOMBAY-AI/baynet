# Contributing to BayNet

Thanks for your interest in contributing to BayNet.

## Getting Started

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Make your changes
4. Run tests (`npm test`)
5. Commit and push
6. Open a PR

## Development Setup

```bash
# Clone
git clone https://github.com/ZOMBAY-AI/baynet.git
cd baynet

# Install dependencies
npm install

# Run tests
npm test

# Run dev server (requires wrangler)
npm run dev
```

## Code Style

- TypeScript strict mode
- No `any` types unless interfacing with external APIs
- Validate all external input at system boundaries
- Fire-and-forget patterns for non-critical persistence (never block the pipeline)
- Fail-closed for safety-critical checks

## Security

If you discover a security vulnerability, please email security@zombay.app instead of opening a public issue.

## Areas for Contribution

- **Detection backends**: Pluggable adapters for Google Vision, AWS Rekognition, custom models
- **Storage backends**: S3, GCS, Azure Blob, local filesystem adapters
- **Export formats**: YOLO, Pascal VOC, TFRecord
- **Dashboard**: Improved bounding box editor, keyboard shortcuts, bulk annotation tools
- **SDK**: npm package for easy integration into any Node.js app
- **Documentation**: Guides, examples, integration tutorials

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
