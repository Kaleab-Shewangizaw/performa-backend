const mongoose = require('mongoose');
const { APPROVAL_ACTIONS } = require('../utils/constants');

const approvalHistorySchema = new mongoose.Schema(
  {
    proforma: { type: mongoose.Schema.Types.ObjectId, ref: 'Proforma', required: true, index: true },
    action: { type: String, enum: APPROVAL_ACTIONS, required: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    comment: { type: String, trim: true, maxlength: 1000, default: '' },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

module.exports = mongoose.model('ApprovalHistory', approvalHistorySchema);
