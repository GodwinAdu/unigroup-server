const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
  associationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Association',
    required: true,
    index: true
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  senderName: {
    type: String,
    required: true
  },
  text: {
    type: String,
    required: true,
    maxlength: 1000
  },
  isEdited: {
    type: Boolean,
    default: false
  },
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChatMessage'
  },
  deletedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Index for efficient queries
chatMessageSchema.index({ associationId: 1, createdAt: -1 });
chatMessageSchema.index({ senderId: 1 });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);